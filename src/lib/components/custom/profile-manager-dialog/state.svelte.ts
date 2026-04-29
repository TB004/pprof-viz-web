import { ProfileService, SettingsService } from "$lib/services";

export type EditorMode = "profile" | "new-profile";

export const dialogState = $state({
	selectedProjectId: undefined as string | undefined,
	selectedProfileId: undefined as string | undefined,
	editorMode: "profile" as EditorMode,
	profileName: "",
	profileUrl: "",
	profileMode: ProfileService.CollectionType.Stream,
	profileToken: "",
	profileIntervalSeconds: 1,
	profileNumberOfCycles: 0,
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
	const defaults = SettingsService.getProfileDefaultsSnapshot();
	dialogState.profileName = defaults.name;
	dialogState.profileUrl = defaults.url;
	dialogState.profileMode = defaults.mode;
	dialogState.profileToken = "";
	dialogState.profileIntervalSeconds = defaults.intervalSeconds;
	dialogState.profileNumberOfCycles = defaults.numberOfCycles;
}
