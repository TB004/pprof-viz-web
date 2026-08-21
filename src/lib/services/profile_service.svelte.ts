// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { browser } from "$app/environment";
import { ProfileIpc, ProjectIpc } from "$lib/ipc";
import type {
	CollectionType,
	ProfileInput,
	ProfileRow,
	ProjectRow,
} from "$lib/types";
import * as ErrorService from "./error_service.svelte.js";

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

export const profileCatalog: ProfileCatalogState = $state({
	loaded: false,
	projects: [],
});

let hydrated = false;

function reportInvokeError(action: string, e: unknown) {
	const message = e instanceof Error ? e.message : String(e);
	void ErrorService.registerError(`${action}: ${message}`);
}

async function reload() {
	const [projects, profiles] = await Promise.all([
		ProjectIpc.listProjects(),
		ProfileIpc.listProfiles(),
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

	profileCatalog.loaded = true;
	profileCatalog.projects = catalog;
}

/** Run a catalog mutation and refresh the catalog afterwards. */
async function mutate<T>(
	verb: string,
	gerund: string,
	op: () => Promise<T>,
): Promise<T | undefined> {
	let result: T;
	try {
		result = await op();
	} catch (e) {
		reportInvokeError(`Failed to ${verb}`, e);
		return undefined;
	}
	try {
		await reload();
	} catch (e) {
		reportInvokeError(`Failed to reload after ${gerund}`, e);
	}
	return result;
}

async function ensureHydrated() {
	if (hydrated) return;
	hydrated = true;
	try {
		await reload();
	} catch (e) {
		profileCatalog.loaded = true;
		profileCatalog.projects = [];
		hydrated = false;
		reportInvokeError("Failed to load projects/profiles", e);
	}
}

/** Every profile as a picker option, skipping any with an unparseable URL. */
export function profileOptions(): CollectionProfile[] {
	return profileCatalog.projects.flatMap((project) =>
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

export async function getProjectById(
	projectId: string,
): Promise<ProjectRow | undefined> {
	try {
		const row = await ProjectIpc.getProjectById(projectId);
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
		const row = await ProfileIpc.getProfileById(profileId);
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
		allowInsecureTls: input.allowInsecureTls,
		intervalSeconds: input.intervalSeconds ?? null,
		numberOfCycles: input.numberOfCycles ?? null,
	};
}

export async function createProject(name: string): Promise<string | undefined> {
	const trimmed = name.trim();
	if (!trimmed) return undefined;
	const project = await mutate("create project", "creating project", () =>
		ProjectIpc.createProject(trimmed),
	);
	return project?.id;
}

export async function renameProject(projectId: string, name: string) {
	const trimmed = name.trim();
	if (!trimmed) return;
	await mutate("rename project", "renaming project", () =>
		ProjectIpc.renameProject(projectId, trimmed),
	);
}

export async function deleteProject(projectId: string) {
	await mutate("delete project", "deleting project", () =>
		ProjectIpc.deleteProject(projectId),
	);
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
	const created = await mutate("create profile", "creating profile", () =>
		ProfileIpc.createProfile(projectId, trimmed),
	);
	return created?.id;
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
	await mutate("update profile", "updating profile", () =>
		ProfileIpc.updateProfile(profileId, trimmed),
	);
}

export async function deleteProfile(profileId: string) {
	await mutate("delete profile", "deleting profile", () =>
		ProfileIpc.deleteProfile(profileId),
	);
}

if (browser) {
	void ensureHydrated();
}
