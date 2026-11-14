<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { CheckIcon, PlugIcon, TrashIcon, UploadIcon } from "@lucide/svelte";
import { profileService } from "#lib/app.svelte.js";
import ConfirmDialog from "#lib/components/confirm-dialog.svelte";
import ErrorAlert from "#lib/components/error-alert.svelte";
import Notice from "#lib/components/notice.svelte";
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
	editProfile,
	openProfileExport,
	snapshotProfileForm,
} from "./state.svelte.js";

const saving = new Task();
const deleting = new Task();

// The manager is mounted once, in the app sidebar; open it from elsewhere with
// `openProfileManager()`. Each opening starts from an empty editor, or from
// the profile it was opened for.
$effect(() => {
	if (!dialogState.managerOpen) {
		return;
	}

	dialogState.selectedProjectId = undefined;
	dialogState.selectedProfileId = undefined;
	dialogState.editorMode = "profile";
	clearProfileForm();
	dialogState.projectDialogOpen = false;

	const focus = dialogState.focusProfileId
		? profileService.find(dialogState.focusProfileId)
		: undefined;
	dialogState.focusProfileId = undefined;
	if (focus) editProfile(focus);
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

const editing = $derived(
	dialogState.editorMode === "new-profile" || !!dialogState.selectedProfileId,
);

const projectName = $derived(
	profileService
		.getCatalog()
		.projects.find((p) => p.id === dialogState.selectedProjectId)?.name ?? "",
);

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
		class="h-[min(680px,calc(100vh-48px))] overflow-hidden sm:max-w-[min(1060px,calc(100%-2rem))]"
	>
		<div
			class="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]"
		>
			<ManagerSidebar />

			<section class="flex min-h-0 flex-col">
				<Dialog.Header class="border-line border-b pb-4">
					<Dialog.Title>Profile configurations</Dialog.Title>
					<Dialog.Description>
						Where to reach a collector and how to sample it. Stored locally.
					</Dialog.Description>
				</Dialog.Header>

				<ScrollArea.Root class="min-h-0 flex-1">
					{#if editing}
						<div
							class="mx-auto flex max-w-[600px] flex-col gap-5 px-6 py-[22px]"
						>
							<div>
								<span class="eyebrow">
									{dialogState.editorMode === "new-profile"
										? `New profile in ${projectName}`
										: projectName}
								</span>
								<h3 class="mt-1 text-[22px] font-[650] tracking-[-0.02em]">
									{#if dialogState.editorMode === "new-profile"}
										Create profile
									{:else}
										{dialogState.profileName || "Untitled profile"}
									{/if}
								</h3>
							</div>

							<ProfileForm />

							{#if dialogState.pingStatus === "success"}
								<Notice tone="ok">{dialogState.pingMessage}</Notice>
							{:else if dialogState.pingStatus === "error"}
								<Notice tone="bad">{dialogState.pingMessage}</Notice>
							{/if}

							<ErrorAlert message={saving.error} />
						</div>
					{:else}
						<div
							class="flex h-full min-h-[360px] flex-col items-center justify-center gap-2.5 p-6 text-center"
						>
							<div
								class="bg-acc-soft text-acc flex size-12 items-center justify-center rounded-xl"
							>
								<PlugIcon class="size-5" />
							</div>
							<p class="font-semibold">Select a profile or create a new one</p>
							<p class="text-muted-foreground max-w-[340px] text-[13px]">
								Pick a profile on the left to edit it, or use + on a project to
								add one.
							</p>
						</div>
					{/if}
				</ScrollArea.Root>

				{#if editing}
					<div
						class="border-line bg-surface-2 flex flex-wrap items-center gap-2 border-t px-6 py-3.5"
					>
						<ConnectionTester />
						<span class="flex-1"></span>
						{#if dialogState.selectedProfileId}
							<Button
								variant="ghost"
								class="text-bad hover:text-bad"
								onclick={() =>
									openDeleteProfileDialog(dialogState.selectedProfileId)}
							>
								<TrashIcon />
								Delete
							</Button>
							<Button
								variant="outline"
								onclick={() =>
									openProfileExport(
										dialogState.profileName,
										dialogState.selectedProfileId ?? "",
									)}
							>
								<UploadIcon />
								Export
							</Button>
						{/if}
						<Button
							onclick={saveProfile}
							disabled={!hasChanges || saving.pending}
						>
							<CheckIcon />
							{dialogState.editorMode === "new-profile"
								? "Create profile"
								: "Save changes"}
						</Button>
					</div>
				{/if}
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
