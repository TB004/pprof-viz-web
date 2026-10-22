<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { CheckIcon, TrashIcon, UploadIcon } from "@lucide/svelte";
import { profileService } from "#lib/app.svelte.js";
import ConfirmDialog from "#lib/components/confirm-dialog.svelte";
import ErrorAlert from "#lib/components/error-alert.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import * as ScrollArea from "#lib/components/ui/scroll-area/index.js";
import { Task } from "#lib/task.svelte.js";
import ExportDialog from "#lib/transfer/export-dialog.svelte";
import { CollectionType } from "#lib/types";
import ConnectionTester from "./connection-tester.svelte";
import ManagerSidebar from "./manager-sidebar.svelte";
import ProfileForm from "./profile-form.svelte";
import ProjectDialog from "./project-dialog.svelte";
import {
	assembleUrl,
	clearProfileForm,
	dialogState,
	openProfileExport,
	snapshotProfileForm,
} from "./state.svelte.js";

const saving = new Task();
const deleting = new Task();

// The manager is mounted once, in the app sidebar; open it from elsewhere with
// `openProfileManager()`. Each opening starts from an empty editor.
$effect(() => {
	if (!dialogState.managerOpen) {
		return;
	}

	dialogState.selectedProjectId = undefined;
	dialogState.selectedProfileId = undefined;
	dialogState.editorMode = "profile";
	clearProfileForm();
	dialogState.projectDialogOpen = false;
});

// A failure belongs to the profile it was made on, not the next one.
$effect(() => {
	void dialogState.selectedProfileId;
	void dialogState.editorMode;
	saving.reset();
});

$effect(() => {
	if (dialogState.deleteDialogOpen) deleting.reset();
});

function openDeleteProfileDialog(profileId?: string) {
	const profile = profileId ? profileService.find(profileId) : undefined;
	if (!profile) {
		return;
	}

	dialogState.deleteDialogType = "profile";
	dialogState.deleteDialogName = profile.name;
	dialogState.deleteDialogProjectId = undefined;
	dialogState.deleteDialogProfileId = profile.id;
	dialogState.deleteDialogOpen = true;
}

// Deletes the project or profile the delete dialog was opened for, and drops
// it from the editor if it was the one being edited.
async function confirmDelete() {
	const projectId = dialogState.deleteDialogProjectId;
	const profileId = dialogState.deleteDialogProfileId;
	const isProject = dialogState.deleteDialogType === "project";

	const ok = await deleting.run(() =>
		isProject && projectId
			? profileService.deleteProject(projectId)
			: profileId
				? profileService.deleteProfile(profileId)
				: Promise.resolve(),
	);
	if (!ok) return;

	const editing = isProject
		? dialogState.selectedProjectId === projectId
		: dialogState.selectedProfileId === profileId;
	if (editing) {
		if (isProject) dialogState.selectedProjectId = undefined;
		dialogState.selectedProfileId = undefined;
		dialogState.editorMode = "profile";
		clearProfileForm();
	}
	dialogState.deleteDialogOpen = false;
}

// Save profile changes to the service, and select the profile in the collection state if successful
async function saveProfile() {
	if (!dialogState.selectedProjectId) {
		return;
	}

	const isStream = dialogState.profileMode === CollectionType.Stream;
	const payload = {
		name: dialogState.profileName,
		url: assembleUrl(),
		mode: dialogState.profileMode,
		token: dialogState.profileToken || null,
		intervalSeconds: isStream ? dialogState.profileIntervalSeconds : null,
		numberOfCycles: isStream ? dialogState.profileNumberOfCycles : null,
	};

	const projectId = dialogState.selectedProjectId;
	if (dialogState.editorMode === "new-profile") {
		const created = await saving.run(() =>
			profileService.createProfile(projectId, payload),
		);
		if (created) clearProfileForm();
		return;
	}

	const profileId = dialogState.selectedProfileId;
	if (!profileId) {
		return;
	}

	const updated = await saving.run(() =>
		profileService.updateProfile(profileId, payload),
	);
	if (updated) dialogState.originalProfile = snapshotProfileForm();
}

const hasChanges = $derived(
	dialogState.editorMode === "new-profile" ||
		!dialogState.originalProfile ||
		dialogState.profileName !== dialogState.originalProfile.name ||
		dialogState.profileScheme !== dialogState.originalProfile.scheme ||
		dialogState.profileUrlHost !== dialogState.originalProfile.urlHost ||
		dialogState.profileMode !== dialogState.originalProfile.mode ||
		dialogState.profileToken !== dialogState.originalProfile.token ||
		dialogState.profileIntervalSeconds !==
			dialogState.originalProfile.intervalSeconds ||
		dialogState.profileNumberOfCycles !==
			dialogState.originalProfile.numberOfCycles,
);
</script>

<Dialog.Root bind:open={dialogState.managerOpen}>
	<Dialog.Content
		class="sm:max-w-[min(96vw,72rem)] max-h-[88vh] p-0 overflow-hidden border-border/70 bg-background shadow-2xl"
	>
		<div
			class="grid max-h-[88vh] min-h-0 grid-cols-1 overflow-hidden md:grid-cols-[18rem_minmax(0,1fr)]"
		>
			<ManagerSidebar />

			<section class="min-h-0 overflow-hidden">
				<div class="flex h-full min-h-0 flex-col">
					<Dialog.Header class="border-b border-border/60 px-6 py-5">
						<Dialog.Title class="text-xl font-semibold"
							>Profile Configurations</Dialog.Title
						>
						<Dialog.Description>
							Create, delete or edit locally stored collection profiles.
						</Dialog.Description>
					</Dialog.Header>

					<ScrollArea.Root class="min-h-0 flex-1 mr-1">
						<div class="px-6 py-6">
							{#if dialogState.editorMode === "new-profile" ||
								dialogState.selectedProfileId}
								<div class="mx-auto max-w-xl space-y-6">
									<div>
										<p class="text-sm font-medium text-muted-foreground">
											{#if dialogState.editorMode === "new-profile"}
												New profile
											{:else}
												Selected profile
											{/if}
										</p>
										<h3 class="text-2xl font-semibold tracking-tight">
											{#if dialogState.editorMode === "new-profile"}
												Create profile
											{:else}
												{dialogState.profileName || "Untitled profile"}
											{/if}
										</h3>
									</div>

									<div class="space-y-6">
										<ProfileForm />

										<ErrorAlert message={saving.error} />

										<div class="flex flex-wrap gap-2 pt-2">
											<Button
												variant="default"
												onclick={saveProfile}
												disabled={!hasChanges || saving.pending}
											>
												<CheckIcon class="size-4" />
												<span>
													{dialogState.editorMode === "new-profile"
														? "Create profile"
														: "Save profile"}
												</span>
											</Button>
											{#if dialogState.selectedProfileId}
												<Button
													variant="destructive"
													onclick={() =>
														openDeleteProfileDialog(
															dialogState.selectedProfileId,
														)}
												>
													<TrashIcon class="size-4" />
													<span>Delete</span>
												</Button>
												<Button
													variant="outline"
													onclick={() =>
														openProfileExport(
															dialogState.profileName,
															dialogState.selectedProfileId ?? "",
														)}
												>
													<UploadIcon class="size-4" />
													<span>Export</span>
												</Button>
											{/if}
											<ConnectionTester />
										</div>
									</div>
								</div>
							{:else}
								<div class="flex h-113 items-center justify-center">
									<div class="max-w-sm text-center">
										<p class="text-sm font-medium text-foreground">
											Select a profile or create a new one
										</p>
										<p class="mt-2 text-sm text-muted-foreground">
											Use the sidebar on the left to add a profile to a project,
											or select an existing profile to edit it or view its
											details.
										</p>
									</div>
								</div>
							{/if}
						</div>
					</ScrollArea.Root>
				</div>
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>

<ProjectDialog />

<ConfirmDialog
	bind:open={dialogState.deleteDialogOpen}
	title={dialogState.deleteDialogType === "project"
		? "Delete project"
		: "Delete profile"}
	description={dialogState.deleteDialogType === "project"
		? `Delete ${dialogState.deleteDialogName} and every profile inside it. This cannot be undone.`
		: `Delete ${dialogState.deleteDialogName}. This cannot be undone.`}
	pending={deleting.pending}
	error={deleting.error}
	onConfirm={confirmDelete}
/>

<ExportDialog
	bind:open={dialogState.exportDialogOpen}
	title={dialogState.exportDialogTitle}
	subtitle={dialogState.exportDialogSubtitle}
	exportScope={dialogState.exportDialogScope}
	suggestedName={dialogState.exportDialogName}
	profileCount={dialogState.exportDialogProfileCount}
/>
