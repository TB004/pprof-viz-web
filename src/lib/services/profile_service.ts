import { derived, type Readable, writable } from "svelte/store";
import { browser } from "$app/environment";
import * as DBService from "$lib/services/db_service.js";
import { genUlid } from "$lib/utils.js";

export enum CollectionType {
	Snapshot = "snapshot",
	Stream = "stream",
}

export interface CollectionProfile {
	value: string;
	label: string;
	projectId: string;
	projectName: string;
	url: URL;
	mode: CollectionType;
}

export interface ProfileRecord {
	id: string;
	projectId: string;
	name: string;
	url: string;
	mode: CollectionType;
	createdAt: number;
	updatedAt: number;
}

export interface ProfileProject {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	profiles: ProfileRecord[];
}

export interface ProfileCatalogState {
	loaded: boolean;
	projects: ProfileProject[];
}

type ProjectRow = Omit<ProfileProject, "profiles">;

const emptyCatalog = (): ProfileCatalogState => ({
	loaded: false,
	projects: [],
});

const profileCatalogStore = writable<ProfileCatalogState>(emptyCatalog());

let hydrated = false;

async function ensureHydrated() {
	if (!hydrated) {
		try {
			const [projects, profiles] = await Promise.all([
				DBService.readProjects(),
				DBService.readProfiles(),
			]);
			const normalizedProfiles = profiles.map((profile) => ({
				...profile,
				mode: profile.mode as CollectionType,
			}));

			const profilesByProjectId = new Map<string, ProfileRecord[]>();
			for (const profile of normalizedProfiles) {
				const list = profilesByProjectId.get(profile.projectId);
				if (list) {
					list.push(profile);
				} else {
					profilesByProjectId.set(profile.projectId, [profile]);
				}
			}

			profileCatalogStore.set({
				loaded: true,
				projects: projects.map((project) => ({
					...project,
					profiles: profilesByProjectId.get(project.id) ?? [],
				})),
			});
		} catch {
			profileCatalogStore.set({
				loaded: true,
				projects: [],
			});
		}
		hydrated = true;
	}
}

function getSnapshot(): ProfileCatalogState {
	let snapshot = emptyCatalog();
	const unsubscribe = profileCatalogStore.subscribe((value) => {
		snapshot = value;
	});
	unsubscribe();
	return snapshot;
}

export const profileCatalog: Readable<ProfileCatalogState> = {
	subscribe: profileCatalogStore.subscribe,
};

export const profileProjects = derived(
	profileCatalogStore,
	(catalog) => catalog.projects,
);

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

export function getProfileById(
	profileId: string,
): { project: ProjectRow; profile: ProfileRecord } | undefined {
	for (const project of getSnapshot().projects) {
		const profile = project.profiles.find((entry) => entry.id === profileId);
		if (profile) {
			return { project, profile };
		}
	}

	return undefined;
}

export async function setActiveProfile(profileId: string | undefined) {
	await ensureHydrated();
	if (profileId && !getProfileById(profileId)) {
		return;
	}
}

export async function createProject(name: string) {
	await ensureHydrated();
	const trimmedName = name.trim();
	if (!trimmedName) {
		return undefined;
	}

	const timestamp = Date.now();
	const project: ProjectRow = {
		id: genUlid(),
		name: trimmedName,
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	await DBService.createOrUpdateProject(project);

	profileCatalogStore.update((catalog) => ({
		...catalog,
		projects: [...catalog.projects, { ...project, profiles: [] }],
	}));

	return project.id;
}

export async function renameProject(projectId: string, name: string) {
	await ensureHydrated();
	const trimmedName = name.trim();
	if (!trimmedName) {
		return;
	}

	const snapshot = getSnapshot();
	const project = snapshot.projects.find((entry) => entry.id === projectId);
	if (!project) {
		return;
	}

	const updatedProject: ProjectRow = {
		id: project.id,
		name: trimmedName,
		createdAt: project.createdAt,
		updatedAt: Date.now(),
	};

	await DBService.createOrUpdateProject(updatedProject);

	profileCatalogStore.update((catalog) => ({
		...catalog,
		projects: catalog.projects.map((entry) =>
			entry.id === projectId
				? { ...entry, name: trimmedName, updatedAt: updatedProject.updatedAt }
				: entry,
		),
	}));
}

export async function deleteProject(projectId: string) {
	await ensureHydrated();
	const snapshot = getSnapshot();
	const project = snapshot.projects.find((entry) => entry.id === projectId);
	if (!project) {
		return;
	}

	for (const profile of project.profiles) {
		await DBService.deleteProfile(profile.id);
	}
	await DBService.deleteProject(projectId);

	profileCatalogStore.update((catalog) => ({
		...catalog,
		projects: catalog.projects.filter((entry) => entry.id !== projectId),
	}));
}

export async function createProfile(
	projectId: string,
	input: { name: string; url: string; mode: CollectionType },
) {
	await ensureHydrated();
	const trimmedName = input.name.trim();
	const trimmedUrl = input.url.trim();
	if (!trimmedName || !trimmedUrl) {
		return undefined;
	}

	try {
		new URL(trimmedUrl);
	} catch {
		return undefined;
	}

	const snapshot = getSnapshot();
	const project = snapshot.projects.find((entry) => entry.id === projectId);
	if (!project) {
		return undefined;
	}

	const timestamp = Date.now();
	const profile: ProfileRecord = {
		id: genUlid(),
		projectId,
		name: trimmedName,
		url: trimmedUrl,
		mode: input.mode,
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	await DBService.createOrUpdateProfile(profile);

	profileCatalogStore.update((catalog) => ({
		...catalog,
		projects: catalog.projects.map((entry) =>
			entry.id === projectId
				? {
						...entry,
						updatedAt: timestamp,
						profiles: [...entry.profiles, profile],
					}
				: entry,
		),
	}));

	return profile.id;
}

export async function updateProfile(
	profileId: string,
	input: { name: string; url: string; mode: CollectionType },
) {
	await ensureHydrated();
	const trimmedName = input.name.trim();
	const trimmedUrl = input.url.trim();
	if (!trimmedName || !trimmedUrl) {
		return;
	}

	try {
		new URL(trimmedUrl);
	} catch {
		return;
	}

	const located = getProfileById(profileId);
	if (!located) {
		return;
	}

	const updatedProfile: ProfileRecord = {
		...located.profile,
		name: trimmedName,
		url: trimmedUrl,
		mode: input.mode,
		updatedAt: Date.now(),
	};

	await DBService.createOrUpdateProfile(updatedProfile);

	profileCatalogStore.update((catalog) => ({
		...catalog,
		projects: catalog.projects.map((entry) => ({
			...entry,
			profiles: entry.profiles.map((profile) =>
				profile.id === profileId ? updatedProfile : profile,
			),
		})),
	}));
}

export async function deleteProfile(profileId: string) {
	await ensureHydrated();
	const located = getProfileById(profileId);
	if (!located) {
		return;
	}

	await DBService.deleteProfile(profileId);

	profileCatalogStore.update((catalog) => ({
		...catalog,
		projects: catalog.projects.map((entry) =>
			entry.id === located.project.id
				? {
						...entry,
						updatedAt: Date.now(),
						profiles: entry.profiles.filter(
							(profile) => profile.id !== profileId,
						),
					}
				: entry,
		),
	}));
}

export function resetProfileCatalog() {
	profileCatalogStore.set(emptyCatalog());
	if (browser) {
		void ensureHydrated();
	}
}

if (browser) {
	void ensureHydrated();
}
