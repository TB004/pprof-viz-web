import { invoke } from "@tauri-apps/api/core";
import { derived, type Readable, writable } from "svelte/store";
import { browser } from "$app/environment";
import { ErrorService } from "$lib/services";
import {
	CollectionType,
	type ProfileInput,
	type ProfileRow,
	type ProjectRow,
} from "$lib/types";

export interface CollectionProfile {
	value: string;
	label: string;
	projectId: string;
	projectName: string;
	url: URL;
	mode: CollectionType;
}

export interface ProfileRecord extends ProfileRow {
	mode: CollectionType;
}

export interface ProfileProject extends ProjectRow {
	profiles: ProfileRecord[];
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

function asEnum(mode: ProfileRow["mode"]): CollectionType {
	return mode === "snapshot" ? CollectionType.Snapshot : CollectionType.Stream;
}

async function reload() {
	const [projects, profiles] = await Promise.all([
		invoke<ProjectRow[]>("list_projects"),
		invoke<ProfileRow[]>("list_profiles"),
	]);

	const profilesByProjectId = new Map<string, ProfileRecord[]>();
	for (const row of profiles) {
		const record: ProfileRecord = { ...row, mode: asEnum(row.mode) };
		const list = profilesByProjectId.get(row.projectId);
		if (list) list.push(record);
		else profilesByProjectId.set(row.projectId, [record]);
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
			project.profiles.map((profile) => ({
				value: profile.id,
				label: profile.name,
				projectId: project.id,
				projectName: project.name,
				url: new URL(profile.url),
				mode: profile.mode,
			})),
		),
);

export async function getProjectById(
	projectId: string,
): Promise<ProjectRow | undefined> {
	const row = await invoke<ProjectRow | null>("get_project_by_id", {
		id: projectId,
	});
	return row ?? undefined;
}

export async function getProfileById(
	profileId: string,
): Promise<ProfileRecord | undefined> {
	const row = await invoke<ProfileRow | null>("get_profile_by_id", {
		id: profileId,
	});
	if (!row) return undefined;
	return { ...row, mode: asEnum(row.mode) };
}

function toInput(input: ProfileInput): ProfileInput {
	return {
		name: input.name.trim(),
		url: input.url.trim(),
		mode: input.mode,
		token: input.token?.trim() || undefined,
		intervalSeconds: input.intervalSeconds,
		numberOfCycles: input.numberOfCycles,
	};
}

export async function createProject(name: string): Promise<string | undefined> {
	const trimmed = name.trim();
	if (!trimmed) return undefined;
	try {
		const project = await invoke<ProjectRow>("create_project", {
			name: trimmed,
		});
		await reload();
		return project.id;
	} catch (e) {
		reportInvokeError("Failed to create project", e);
		return undefined;
	}
}

export async function renameProject(projectId: string, name: string) {
	const trimmed = name.trim();
	if (!trimmed) return;
	try {
		await invoke("rename_project", { id: projectId, name: trimmed });
		await reload();
	} catch (e) {
		reportInvokeError("Failed to rename project", e);
	}
}

export async function deleteProject(projectId: string) {
	try {
		await invoke("delete_project", { id: projectId });
		await reload();
	} catch (e) {
		reportInvokeError("Failed to delete project", e);
	}
}

export async function createProfile(
	projectId: string,
	input: ProfileInput,
): Promise<string | undefined> {
	const trimmed = toInput(input);
	if (!trimmed.name || !trimmed.url) return undefined;
	try {
		const created = await invoke<ProfileRow>("create_profile", {
			projectId,
			input: trimmed,
		});
		await reload();
		return created.id;
	} catch (e) {
		reportInvokeError("Failed to create profile", e);
		return undefined;
	}
}

export async function updateProfile(profileId: string, input: ProfileInput) {
	const trimmed = toInput(input);
	if (!trimmed.name || !trimmed.url) return;
	try {
		await invoke("update_profile", { id: profileId, input: trimmed });
		await reload();
	} catch (e) {
		reportInvokeError("Failed to update profile", e);
	}
}

export async function deleteProfile(profileId: string) {
	try {
		await invoke("delete_profile", { id: profileId });
		await reload();
	} catch (e) {
		reportInvokeError("Failed to delete profile", e);
	}
}

if (browser) {
	void ensureHydrated();
}
