import { SettingsService } from "$lib/services";
import { CollectionType } from "$lib/types";

export type EditorMode = "profile" | "new-profile";

export const dialogState = $state({
	selectedProjectId: undefined as string | undefined,
	selectedProfileId: undefined as string | undefined,
	editorMode: "profile" as EditorMode,
	profileName: "",
	profileUrl: "",
	profileMode: CollectionType.Stream,
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
	const settings = SettingsService.getSettingsSnapshot();
	dialogState.profileName = settings.defaultName;
	dialogState.profileUrl = settings.defaultUrl;
	dialogState.profileMode = settings.defaultMode as CollectionType;
	dialogState.profileToken = "";
	dialogState.profileIntervalSeconds = settings.defaultIntervalSeconds;
	dialogState.profileNumberOfCycles = settings.defaultNumberOfCycles;
}
