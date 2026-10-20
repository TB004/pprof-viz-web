// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { buildUrl, parseUrl } from "#lib/components/custom/profile-form";
import { type ProfileProject, settingsService } from "#lib/services";
import { CollectionType, type ExportScope } from "#lib/types";

export type EditorMode = "profile" | "new-profile";

export type ProfileSnapshot = {
	name: string;
	scheme: "http" | "https";
	urlHost: string;
	mode: CollectionType;
	token: string;
	intervalSeconds: number;
	numberOfCycles: number;
};

export const dialogState = $state({
	selectedProjectId: undefined as string | undefined,
	selectedProfileId: undefined as string | undefined,
	editorMode: "profile" as EditorMode,
	profileName: "",
	profileScheme: "http" as "http" | "https",
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
	const { scheme, host } = parseUrl(settings.defaultUrl);
	dialogState.profileScheme = scheme;
	dialogState.profileUrlHost = host;
	dialogState.profileMode = settings.defaultMode as CollectionType;
	dialogState.profileToken = "";
	dialogState.profileIntervalSeconds = settings.defaultIntervalSeconds;
	dialogState.profileNumberOfCycles = settings.defaultNumberOfCycles;
}

/** Assemble the full URL from the current scheme + host state. */
export function assembleUrl(): string {
	return buildUrl(dialogState.profileScheme, dialogState.profileUrlHost);
}
