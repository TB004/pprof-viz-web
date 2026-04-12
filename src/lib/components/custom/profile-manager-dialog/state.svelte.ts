import { ProfileService } from "$lib/services";

export type EditorMode = "profile" | "new-profile";

export const dialogState = $state({
	selectedProjectId: undefined as string | undefined,
	selectedProfileId: undefined as string | undefined,
	editorMode: "profile" as EditorMode,
	profileName: "",
	profileUrl: "",
	profileMode: ProfileService.CollectionType.Stream,
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
}
