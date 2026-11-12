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
	<Dialog.Content>
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

		<div class="flex flex-col gap-4 px-[22px] py-3.5">
			<div>
				<label for="project-name" class="mb-2 block text-[13px] font-[550]">
					Project name
				</label>
				<Input id="project-name" bind:value={name} placeholder="Production" />
			</div>
			<ErrorAlert message={saving.error} />
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={cancel}>Cancel</Button>
			<Button disabled={!name.trim() || saving.pending} onclick={confirm}>
				{dialogState.projectDialogMode === "create" ? "Create" : "Save"}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
