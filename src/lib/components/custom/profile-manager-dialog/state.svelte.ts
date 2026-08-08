// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { SettingsService } from "$lib/services";
import { CollectionType, HttpVersion } from "$lib/types";

export type EditorMode = "profile" | "new-profile";

export type ProfileSnapshot = {
	name: string;
	scheme: "http" | "https";
	urlHost: string;
	mode: CollectionType;
	httpVersion: HttpVersion;
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
	profileMode: CollectionType.Stream,
	profileHttpVersion: HttpVersion.Http2,
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
});

export function clearProfileForm() {
	const settings = SettingsService.getSettingsSnapshot();
	dialogState.profileName = settings.defaultName;
	// Parse the default URL into scheme + host (regex handles scheme-only like "https://")
	const m = settings.defaultUrl.match(/^(https?):\/\/([^/]*)/);
	if (m) {
		dialogState.profileScheme = m[1] as "http" | "https";
		dialogState.profileUrlHost = m[2];
	} else {
		dialogState.profileScheme = "http";
		dialogState.profileUrlHost = "";
	}
	dialogState.profileMode = settings.defaultMode as CollectionType;
	dialogState.profileHttpVersion =
		settings.defaultHttpVersion ?? HttpVersion.Http2;
	dialogState.profileToken = "";
	dialogState.profileIntervalSeconds = settings.defaultIntervalSeconds;
	dialogState.profileNumberOfCycles = settings.defaultNumberOfCycles;
}

/** Assemble the full URL from the current scheme + host state. */
export function assembleUrl(): string {
	return `${dialogState.profileScheme}://${dialogState.profileUrlHost.trim()}`;
}
