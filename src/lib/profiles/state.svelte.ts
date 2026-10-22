// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

// The profile manager's dialogs share one editor state, so opening a dialog
// from the sidebar and saving from the editor see the same selection.

import { settingsService } from "#lib/app.svelte.js";
import type { ExportScope } from "#lib/transfer/transfer.svelte.js";
import { CollectionType, type ProfileRow } from "#lib/types";
import type { ProfileProject } from "./profiles.svelte.js";
import { buildUrl, type Scheme, splitUrl } from "./url-field.svelte";

export type EditorMode = "profile" | "new-profile";

export type ProfileSnapshot = {
	name: string;
	scheme: Scheme;
	urlHost: string;
	mode: CollectionType;
	token: string;
	intervalSeconds: number;
	numberOfCycles: number;
};

export const dialogState = $state({
	/** The manager itself; mounted once, in the app sidebar. */
	managerOpen: false,
	selectedProjectId: undefined as string | undefined,
	selectedProfileId: undefined as string | undefined,
	editorMode: "profile" as EditorMode,
	profileName: "",
	profileScheme: "http" as Scheme,
	profileUrlHost: "",
	profileMode: CollectionType.Stream as CollectionType,
	profileToken: "",
	profileIntervalSeconds: 1,
	profileNumberOfCycles: 0,
	originalProfile: null as ProfileSnapshot | null,
	projectDialogOpen: false,
	projectDialogMode: "create" as "create" | "rename",
	projectDialogProjectId: undefined as string | undefined,
	deleteDialogOpen: false,
	deleteDialogType: "project" as "project" | "profile",
	deleteDialogName: "",
	deleteDialogProjectId: undefined as string | undefined,
	deleteDialogProfileId: undefined as string | undefined,
	exportDialogOpen: false,
	exportDialogTitle: "",
	exportDialogSubtitle: "",
	exportDialogName: "",
	exportDialogScope: {} as ExportScope,
	exportDialogProfileCount: 0,
});

/** Open the profile manager from anywhere in the app. */
export function openProfileManager() {
	dialogState.managerOpen = true;
}

/** Open the export dialog for one project and everything under it. */
export function openProjectExport(project: ProfileProject) {
	dialogState.exportDialogTitle = `Export "${project.name}"`;
	dialogState.exportDialogSubtitle =
		"The project, its profiles, and optionally the collections captured with them.";
	dialogState.exportDialogName = project.name;
	dialogState.exportDialogScope = { projectIds: [project.id] };
	dialogState.exportDialogProfileCount = project.profiles.length;
	dialogState.exportDialogOpen = true;
}

/** Open the export dialog for a single profile, with its project alongside. */
export function openProfileExport(name: string, profileId: string) {
	dialogState.exportDialogTitle = `Export "${name}"`;
	dialogState.exportDialogSubtitle =
		"The profile and its project, and optionally the collections captured with it.";
	dialogState.exportDialogName = name;
	dialogState.exportDialogScope = { profileIds: [profileId] };
	dialogState.exportDialogProfileCount = 1;
	dialogState.exportDialogOpen = true;
}

export function clearProfileForm() {
	const settings = settingsService.getSettings();
	dialogState.profileName = settings.defaultName;
	const { scheme, host } = splitUrl(settings.defaultUrl);
	dialogState.profileScheme = scheme;
	dialogState.profileUrlHost = host;
	dialogState.profileMode = settings.defaultMode as CollectionType;
	dialogState.profileToken = "";
	dialogState.profileIntervalSeconds = settings.defaultIntervalSeconds;
	dialogState.profileNumberOfCycles = settings.defaultNumberOfCycles;
}

/** Fill the editor from a stored profile. */
export function loadProfileIntoForm(profile: ProfileRow) {
	const { scheme, host } = splitUrl(profile.url);
	dialogState.profileName = profile.name;
	dialogState.profileScheme = scheme;
	dialogState.profileUrlHost = host;
	dialogState.profileMode = profile.mode;
	dialogState.profileToken = profile.token ?? "";
	dialogState.profileIntervalSeconds = profile.intervalSeconds ?? 1;
	dialogState.profileNumberOfCycles = profile.numberOfCycles ?? 0;
	dialogState.originalProfile = snapshotProfileForm();
}

/** The editor's fields as they are now, to tell later edits apart. */
export function snapshotProfileForm(): ProfileSnapshot {
	return {
		name: dialogState.profileName,
		scheme: dialogState.profileScheme,
		urlHost: dialogState.profileUrlHost,
		mode: dialogState.profileMode,
		token: dialogState.profileToken,
		intervalSeconds: dialogState.profileIntervalSeconds,
		numberOfCycles: dialogState.profileNumberOfCycles,
	};
}

/** Assemble the full URL from the current scheme + host state. */
export function assembleUrl(): string {
	return buildUrl(dialogState.profileScheme, dialogState.profileUrlHost);
}
