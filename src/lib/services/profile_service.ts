// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { derived, type Readable, writable } from "svelte/store";
import { browser } from "$app/environment";
import * as Ipc from "$lib/ipc";
import { ErrorService } from "$lib/services";
import type {
	CollectionType,
	ProfileInput,
	ProfileRow,
	ProjectRow,
} from "$lib/types";

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

const emptyCatalog = (): ProfileCatalogState => ({
	loaded: false,
	projects: [],
});

const profileCatalogStore = writable<ProfileCatalogState>(emptyCatalog());

export const profileCatalog: Readable<ProfileCatalogState> = {
	subscribe: profileCatalogStore.subscribe,
};

export const profileProjects = derived(
	profileCatalogStore,
	(catalog) => catalog.projects,
);

let hydrated = false;

function reportInvokeError(action: string, e: unknown) {
	const message = e instanceof Error ? e.message : String(e);
	void ErrorService.registerError(`${action}: ${message}`);
}

async function reload() {
	const [projects, profiles] = await Promise.all([
		Ipc.listProjects(),
		Ipc.listProfiles(),
	]);

	const profilesByProjectId = new Map<string, ProfileRow[]>();
	for (const row of profiles) {
		const list = profilesByProjectId.get(row.projectId);
		if (list) list.push(row);
		else profilesByProjectId.set(row.projectId, [row]);
	}

	const catalog = projects.map((project) => ({
		...project,
		profiles: profilesByProjectId.get(project.id) ?? [],
	}));

	profileCatalogStore.set({
		loaded: true,
		projects: catalog,
	});
}

async function ensureHydrated() {
	if (hydrated) return;
	hydrated = true;
	try {
		await reload();
	} catch (e) {
		profileCatalogStore.set({ loaded: true, projects: [] });
		hydrated = false;
		reportInvokeError("Failed to load projects/profiles", e);
	}
}

export const profileOptions: Readable<CollectionProfile[]> = derived(
	profileCatalogStore,
	(catalog) =>
		catalog.projects.flatMap((project) =>
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
		),
);

export async function getProjectById(
	projectId: string,
): Promise<ProjectRow | undefined> {
	try {
		const row = await Ipc.getProjectById(projectId);
		return row ?? undefined;
	} catch (e) {
		reportInvokeError("Failed to get project", e);
		return undefined;
	}
}

export async function getProfileById(
	profileId: string,
): Promise<ProfileRow | undefined> {
	try {
		const row = await Ipc.getProfileById(profileId);
		return row ?? undefined;
	} catch (e) {
		reportInvokeError("Failed to get profile", e);
		return undefined;
	}
}

function toInput(input: ProfileInput): ProfileInput {
	return {
		name: input.name.trim(),
		url: input.url.trim(),
		mode: input.mode,
		httpVersion: input.httpVersion,
		token: input.token?.trim() || null,
		intervalSeconds: input.intervalSeconds ?? null,
		numberOfCycles: input.numberOfCycles ?? null,
	};
}

export async function createProject(name: string): Promise<string | undefined> {
	const trimmed = name.trim();
	if (!trimmed) return undefined;
	let id: string;
	try {
		const project = await Ipc.createProject(trimmed);
		id = project.id;
	} catch (e) {
		reportInvokeError("Failed to create project", e);
		return undefined;
	}
	try {
		await reload();
	} catch (e) {
		reportInvokeError("Failed to reload after creating project", e);
	}
	return id;
}

export async function renameProject(projectId: string, name: string) {
	const trimmed = name.trim();
	if (!trimmed) return;
	try {
		await Ipc.renameProject(projectId, trimmed);
	} catch (e) {
		reportInvokeError("Failed to rename project", e);
		return;
	}
	try {
		await reload();
	} catch (e) {
		reportInvokeError("Failed to reload after renaming project", e);
	}
}

export async function deleteProject(projectId: string) {
	try {
		await Ipc.deleteProject(projectId);
	} catch (e) {
		reportInvokeError("Failed to delete project", e);
		return;
	}
	try {
		await reload();
	} catch (e) {
		reportInvokeError("Failed to reload after deleting project", e);
	}
}

export async function createProfile(
	projectId: string,
	input: ProfileInput,
): Promise<string | undefined> {
	const trimmed = toInput(input);
	if (!trimmed.name || !trimmed.url) return undefined;
	try {
		new URL(trimmed.url);
	} catch {
		reportInvokeError("Failed to create profile", new Error("Invalid URL"));
		return undefined;
	}
	let id: string;
	try {
		const created = await Ipc.createProfile(projectId, trimmed);
		id = created.id;
	} catch (e) {
		reportInvokeError("Failed to create profile", e);
		return undefined;
	}
	try {
		await reload();
	} catch (e) {
		reportInvokeError("Failed to reload after creating profile", e);
	}
	return id;
}

export async function updateProfile(profileId: string, input: ProfileInput) {
	const trimmed = toInput(input);
	if (!trimmed.name || !trimmed.url) return;
	try {
		new URL(trimmed.url);
	} catch {
		reportInvokeError("Failed to update profile", new Error("Invalid URL"));
		return;
	}
	try {
		await Ipc.updateProfile(profileId, trimmed);
	} catch (e) {
		reportInvokeError("Failed to update profile", e);
		return;
	}
	try {
		await reload();
	} catch (e) {
		reportInvokeError("Failed to reload after updating profile", e);
	}
}

export async function deleteProfile(profileId: string) {
	try {
		await Ipc.deleteProfile(profileId);
	} catch (e) {
		reportInvokeError("Failed to delete profile", e);
		return;
	}
	try {
		await reload();
	} catch (e) {
		reportInvokeError("Failed to reload after deleting profile", e);
	}
}

if (browser) {
	void ensureHydrated();
}
