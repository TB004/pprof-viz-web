// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { Profiles, Projects } from "#lib/data";
import type { DBStore } from "#lib/storage";
import type {
	CollectionType,
	ProfileInput,
	ProfileRow,
	ProjectRow,
} from "#lib/types";
import { browser } from "$app/env";
import type { ErrorService } from "./error_service.svelte.js";

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
}

export class ProfileService {
	readonly #state: ProfileCatalogState;
	readonly #projects: Projects;
	readonly #profiles: Profiles;
	readonly #errors: ErrorService;
	#hydrated = false;

	constructor(db: DBStore, errors: ErrorService) {
		this.#projects = new Projects(db);
		this.#profiles = new Profiles(db);
		this.#errors = errors;
		this.#state = $state<ProfileCatalogState>({
			loaded: false,
			projects: [],
		});

		if (browser) {
			void this.#ensureHydrated();
		}
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

	async getProjectById(projectId: string): Promise<ProjectRow | undefined> {
		try {
			return await this.#projects.get(projectId);
		} catch (error) {
			this.#errors.reportFailure("Failed to get project", error);
			return undefined;
		}
	}

	async getProfileById(profileId: string): Promise<ProfileRow | undefined> {
		try {
			return await this.#profiles.get(profileId);
		} catch (error) {
			this.#errors.reportFailure("Failed to get profile", error);
			return undefined;
		}
	}

	async createProject(name: string): Promise<string | undefined> {
		if (!name.trim()) return undefined;
		const project = await this.#mutate("create project", () =>
			this.#projects.create(name),
		);
		return project?.id;
	}

	async renameProject(projectId: string, name: string): Promise<void> {
		if (!name.trim()) return;
		await this.#mutate("rename project", () =>
			this.#projects.rename(projectId, name),
		);
	}

	async deleteProject(projectId: string): Promise<void> {
		await this.#mutate("delete project", () =>
			this.#projects.remove(projectId),
		);
	}

	async createProfile(
		projectId: string,
		input: ProfileInput,
	): Promise<string | undefined> {
		const created = await this.#mutate("create profile", () =>
			this.#profiles.create(projectId, input),
		);
		return created?.id;
	}

	async updateProfile(profileId: string, input: ProfileInput): Promise<void> {
		await this.#mutate("update profile", () =>
			this.#profiles.update(profileId, input),
		);
	}

	async deleteProfile(profileId: string): Promise<void> {
		await this.#mutate("delete profile", () =>
			this.#profiles.remove(profileId),
		);
	}

	async #reload(): Promise<void> {
		const [projects, profiles] = await Promise.all([
			this.#projects.list(),
			this.#profiles.list(),
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
		this.#state.loaded = true;
	}

	/** Run a catalog mutation, then refresh the catalog. */
	async #mutate<T>(
		verb: string,
		operation: () => Promise<T>,
	): Promise<T | undefined> {
		let result: T;
		try {
			result = await operation();
		} catch (error) {
			this.#errors.reportFailure(`Failed to ${verb}`, error);
			return undefined;
		}
		try {
			await this.#reload();
		} catch (error) {
			this.#errors.reportFailure(`Failed to reload after ${verb}`, error);
		}
		return result;
	}

	async #ensureHydrated(): Promise<void> {
		if (this.#hydrated) return;
		this.#hydrated = true;
		try {
			await this.#reload();
		} catch (error) {
			this.#state.loaded = true;
			this.#state.projects = [];
			this.#hydrated = false;
			this.#errors.reportFailure("Failed to load projects and profiles", error);
		}
	}
}
