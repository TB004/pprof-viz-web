import { ProfileService } from "$lib/services";

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
	dialogState.profileName = "";
	dialogState.profileUrl = "";
	dialogState.profileMode = ProfileService.CollectionType.Stream;
	dialogState.profileToken = "";
	dialogState.profileIntervalSeconds = 1;
	dialogState.profileNumberOfCycles = 0;
}
