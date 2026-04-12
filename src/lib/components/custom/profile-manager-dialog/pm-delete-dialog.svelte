<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ProfileService } from "$lib/services";
import { clearProfileForm, dialogState } from "./state.svelte.ts";

// Deletes a profile or project based on the dialogState. After deletion, it checks if the deleted item
// is currently selected and clears the selection if necessary.
async function confirm() {
	if (
		dialogState.deleteDialogType === "project" &&
		dialogState.deleteDialogProjectId
	) {
		await ProfileService.deleteProject(dialogState.deleteDialogProjectId);

		if (dialogState.selectedProjectId === dialogState.deleteDialogProjectId) {
			dialogState.selectedProjectId = undefined;
			dialogState.selectedProfileId = undefined;
			dialogState.editorMode = "profile";
			clearProfileForm();
		}
	} else if (
		dialogState.deleteDialogType === "profile" &&
		dialogState.deleteDialogProfileId
	) {
		await ProfileService.deleteProfile(dialogState.deleteDialogProfileId);

		if (dialogState.selectedProfileId === dialogState.deleteDialogProfileId) {
			dialogState.selectedProfileId = undefined;
			dialogState.editorMode = "profile";
			clearProfileForm();
		}
	}

	dialogState.deleteDialogOpen = false;
}

function cancel() {
	dialogState.deleteDialogOpen = false;
}
</script>

<Dialog.Root bind:open={dialogState.deleteDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{dialogState.deleteDialogType === "project"
					? "Delete project"
					: "Delete profile"}
			</Dialog.Title>
			<Dialog.Description>
				{dialogState.deleteDialogType === "project"
					? `Delete ${dialogState.deleteDialogName} and every profile inside it. This cannot be undone.`
					: `Delete ${dialogState.deleteDialogName}. This cannot be undone.`}
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-wrap justify-end gap-2 px-6">
			<Button variant="outline" onclick={cancel}>Cancel</Button>
			<Button variant="destructive" onclick={confirm}>Delete</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
