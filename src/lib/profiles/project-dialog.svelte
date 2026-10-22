<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { profileService } from "#lib/app.svelte.js";
import ErrorAlert from "#lib/components/error-alert.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import Input from "#lib/components/ui/input/input.svelte";
import { Task } from "#lib/task.svelte.js";
import { clearProfileForm, dialogState } from "./state.svelte.js";

let name = $state("");
const saving = new Task();

// When the dialog opens, if we're in rename mode, we want to populate the input with the current project name.
$effect(() => {
	if (dialogState.projectDialogOpen) {
		saving.reset();
		if (
			dialogState.projectDialogMode === "rename" &&
			dialogState.projectDialogProjectId
		) {
			const project = profileService
				.getCatalog()
				.projects.find((p) => p.id === dialogState.projectDialogProjectId);
			name = project?.name ?? "";
		} else {
			name = "";
		}
	}
});

// Create or rename the project based on the dialog mode, then close the dialog.
async function confirm() {
	const projectId = dialogState.projectDialogProjectId;
	const ok = await saving.run(async () => {
		if (dialogState.projectDialogMode === "create") {
			dialogState.selectedProjectId = await profileService.createProject(name);
			dialogState.selectedProfileId = undefined;
			dialogState.editorMode = "profile";
			clearProfileForm();
		} else if (projectId) {
			await profileService.renameProject(projectId, name);
		}
	});
	if (ok) dialogState.projectDialogOpen = false;
}

function cancel() {
	dialogState.projectDialogOpen = false;
}
</script>

<Dialog.Root bind:open={dialogState.projectDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{dialogState.projectDialogMode === "create"
					? "Create project"
					: "Rename project"}
			</Dialog.Title>
			<Dialog.Description>
				{dialogState.projectDialogMode === "create"
					? "Enter a project name before adding profiles."
					: "Update the project name and save the change."}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 px-6">
			<label class="block">
				<span class="mb-3 block text-sm font-medium text-foreground"
					>Project name</span
				>
				<Input bind:value={name} placeholder="Production" />
			</label>

			<ErrorAlert message={saving.error} />

			<div class="flex flex-wrap justify-end gap-2 pt-2">
				<Button variant="outline" onclick={cancel}>Cancel</Button>
				<Button
					variant="default"
					disabled={!name.trim() || saving.pending}
					onclick={confirm}
				>
					{dialogState.projectDialogMode === "create" ? "Create" : "Save"}
				</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
