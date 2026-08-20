<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { ConfirmDialog } from "$lib/components/custom/confirm-dialog";
import { ProfileService } from "$lib/services";
import { clearProfileForm, dialogState } from "./state.svelte.ts";

const isProject = $derived(dialogState.deleteDialogType === "project");

// Deletes a profile or project based on the dialogState. After deletion, it checks if the deleted item
// is currently selected and clears the selection if necessary.
async function confirm() {
	if (isProject && dialogState.deleteDialogProjectId) {
		await ProfileService.deleteProject(dialogState.deleteDialogProjectId);

		if (dialogState.selectedProjectId === dialogState.deleteDialogProjectId) {
			dialogState.selectedProjectId = undefined;
			dialogState.selectedProfileId = undefined;
			dialogState.editorMode = "profile";
			clearProfileForm();
		}
	} else if (!isProject && dialogState.deleteDialogProfileId) {
		await ProfileService.deleteProfile(dialogState.deleteDialogProfileId);

		if (dialogState.selectedProfileId === dialogState.deleteDialogProfileId) {
			dialogState.selectedProfileId = undefined;
			dialogState.editorMode = "profile";
			clearProfileForm();
		}
	}

	dialogState.deleteDialogOpen = false;
}
</script>

<ConfirmDialog
	bind:open={dialogState.deleteDialogOpen}
	title={isProject ? "Delete project" : "Delete profile"}
	description={isProject
		? `Delete ${dialogState.deleteDialogName} and every profile inside it. This cannot be undone.`
		: `Delete ${dialogState.deleteDialogName}. This cannot be undone.`}
	onConfirm={confirm}
/>
