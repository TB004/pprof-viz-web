// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { type DBStore, ProfileIndex, Store } from "#lib/db";
import { pingCollector } from "#lib/session/collector.js";
import type {
	CollectionType,
	ProfileInput,
	ProfileRow,
	ProjectRow,
} from "#lib/types";
import { errorMessage, requireText, trimToNull, ulid } from "#lib/utils";
import { browser } from "$app/env";

export interface CollectionProfile {
	value: string;
	label: string;
	projectId: string;
	projectName: string;
	url: URL;
	mode: CollectionType;
}

export interface ProfileProject extends ProjectRow {
	profiles: ProfileRow[];
}

export interface ProfileCatalogState {
	loaded: boolean;
	projects: ProfileProject[];
	/** Why the catalog could not be read; the dialogs listing it show this. */
	error: string | null;
}

/** Trim the user-supplied fields and reject anything the RPC layer can't use. */
function normalize(input: ProfileInput): ProfileInput {
	const url = requireText(input.url, "profile url");
	try {
		new URL(url);
	} catch {
		throw new Error(`invalid url: ${url}`);
	}
	return {
		name: requireText(input.name, "profile name"),
		url,
		mode: input.mode,
		token: trimToNull(input.token),
		intervalSeconds: input.intervalSeconds ?? null,
		numberOfCycles: input.numberOfCycles ?? null,
	};
}

/**
 * Projects and the collection profiles inside them, kept in memory as a
 * reactive catalog. Mutations throw, for the dialog that made them to report.
 */
export class ProfileService {
	readonly #state: ProfileCatalogState;
	readonly #db: DBStore;

	constructor(db: DBStore) {
		this.#db = db;
		this.#state = $state<ProfileCatalogState>({
			loaded: false,
			projects: [],
			error: null,
		});

		if (browser) void this.refresh();
	}

	/** Projects with their profiles attached. Reactive; read-only outside here. */
	getCatalog(): ProfileCatalogState {
		return this.#state;
	}

	/** Every profile as a picker option, skipping any with an unparseable URL. */
	profileOptions(): CollectionProfile[] {
		return this.#state.projects.flatMap((project) =>
			project.profiles.flatMap((profile) => {
				try {
					return [
						{
							value: profile.id,
							label: profile.name,
							projectId: project.id,
							projectName: project.name,
							url: new URL(profile.url),
							mode: profile.mode,
						},
					];
				} catch {
					return [];
				}
			}),
		);
	}

	/** A profile from the in-memory catalog. */
	find(profileId: string): ProfileRow | undefined {
		for (const project of this.#state.projects) {
			const profile = project.profiles.find((row) => row.id === profileId);
			if (profile) return profile;
		}
		return undefined;
	}

	/** A profile as currently stored, which the catalog may lag behind. */
	async get(profileId: string): Promise<ProfileRow> {
		const row = await this.#db.get<ProfileRow>(Store.Profiles, profileId);
		if (!row) throw new Error("the selected profile no longer exists");
		return row;
	}

	async createProject(name: string): Promise<string> {
		const now = Date.now();
		const row: ProjectRow = {
			id: ulid(now),
			name: requireText(name, "project name"),
			createdAt: now,
			updatedAt: now,
		};
		await this.#db.add(Store.Projects, row);
		await this.refresh();
		return row.id;
	}

	async renameProject(projectId: string, name: string): Promise<void> {
		const trimmed = requireText(name, "project name");
		await this.#db.update<ProjectRow>(Store.Projects, projectId, (row) => ({
			...row,
			name: trimmed,
			updatedAt: Date.now(),
		}));
		await this.refresh();
	}

	/** Delete a project and every profile that belongs to it. */
	async deleteProject(projectId: string): Promise<void> {
		await this.#db.delete(Store.Projects, projectId, {
			store: Store.Profiles,
			index: ProfileIndex.ByProject,
		});
		await this.refresh();
	}

	async createProfile(projectId: string, input: ProfileInput): Promise<string> {
		const now = Date.now();
		const row: ProfileRow = {
			...normalize(input),
			id: ulid(now),
			projectId,
			createdAt: now,
			updatedAt: now,
		};
		await this.#db.add(Store.Profiles, row);
		await this.refresh();
		return row.id;
	}

	async updateProfile(profileId: string, input: ProfileInput): Promise<void> {
		const normalized = normalize(input);
		await this.#db.update<ProfileRow>(Store.Profiles, profileId, (row) => ({
			...row,
			...normalized,
			updatedAt: Date.now(),
		}));
		await this.refresh();
	}

	async deleteProfile(profileId: string): Promise<void> {
		await this.#db.delete(Store.Profiles, profileId);
		await this.refresh();
	}

	/** Check that a collector answers at `url`, before the profile is saved. */
	ping(url: string, token: string | null): Promise<void> {
		return pingCollector(url, token);
	}

	/**
	 * Re-read the catalog. Never throws: a failure is the catalog's own state,
	 * shown wherever it is listed, while the change that triggered the reload
	 * did go through.
	 */
	async refresh(): Promise<void> {
		try {
			const [projects, profiles] = await Promise.all([
				this.#db.getAll<ProjectRow>(Store.Projects),
				this.#db.getAll<ProfileRow>(Store.Profiles),
			]);

			const byProject = new Map<string, ProfileRow[]>();
			for (const row of profiles) {
				const list = byProject.get(row.projectId);
				if (list) list.push(row);
				else byProject.set(row.projectId, [row]);
			}

			this.#state.projects = projects.map((project) => ({
				...project,
				profiles: byProject.get(project.id) ?? [],
			}));
			this.#state.error = null;
		} catch (error) {
			this.#state.error = `Failed to load projects and profiles: ${errorMessage(error)}`;
		} finally {
			this.#state.loaded = true;
		}
	}
}
