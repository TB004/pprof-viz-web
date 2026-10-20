<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { CheckIcon, TrashIcon } from "@lucide/svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import * as ScrollArea from "#lib/components/ui/scroll-area/index.js";
import { profileService } from "#lib/services";
import { CollectionType } from "#lib/types";
import ConnectionTester from "./connection-tester.svelte";
import PMDeleteDialog from "./pm-delete-dialog.svelte";
import PMProjectDialog from "./pm-project-dialog.svelte";
import PMSidebar from "./pm-sidebar.svelte";
import ProfileForm from "./profile-form.svelte";
import { assembleUrl, clearProfileForm, dialogState } from "./state.svelte.ts";

type Props = {
	open?: boolean;
};

let { open = $bindable(false) }: Props = $props();

// Reset dialog state when opened
$effect(() => {
	if (!open) {
		return;
	}

	dialogState.selectedProjectId = undefined;
	dialogState.selectedProfileId = undefined;
	dialogState.editorMode = "profile";
	clearProfileForm();
	dialogState.projectDialogOpen = false;
});

async function openDeleteProfileDialog(profileId?: string) {
	if (!profileId) {
		return;
	}
	const profile = await profileService.getProfileById(profileId);
	if (!profile) {
		return;
	}

	dialogState.deleteDialogType = "profile";
	dialogState.deleteDialogName = profile.name;
	dialogState.deleteDialogProjectId = undefined;
	dialogState.deleteDialogProfileId = profileId;
	dialogState.deleteDialogOpen = true;
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

	if (dialogState.editorMode === "new-profile") {
		const createdProfileId = await profileService.createProfile(
			dialogState.selectedProjectId,
			payload,
		);
		if (createdProfileId) {
			dialogState.selectedProfileId = undefined;
			dialogState.editorMode = "new-profile";
			clearProfileForm();
		}
		return;
	}

	if (!dialogState.selectedProfileId) {
		return;
	}

	await profileService.updateProfile(dialogState.selectedProfileId, payload);

	dialogState.originalProfile = {
		name: dialogState.profileName,
		scheme: dialogState.profileScheme,
		urlHost: dialogState.profileUrlHost,
		mode: dialogState.profileMode,
		token: dialogState.profileToken,
		intervalSeconds: dialogState.profileIntervalSeconds,
		numberOfCycles: dialogState.profileNumberOfCycles,
	};
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

<Dialog.Root bind:open>
	<Dialog.Content
		class="sm:max-w-[min(96vw,72rem)] max-h-[88vh] p-0 overflow-hidden border-border/70 bg-background shadow-2xl"
	>
		<div
			class="grid max-h-[88vh] min-h-0 grid-cols-1 overflow-hidden md:grid-cols-[18rem_minmax(0,1fr)]"
		>
			<PMSidebar />

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

										<div class="flex flex-wrap gap-2 pt-2">
											<Button
												variant="default"
												onclick={saveProfile}
												disabled={!hasChanges}
											>
												<CheckIcon class="size-4" />
												<span>
													{dialogState.editorMode === "new-profile"
														? "Create profile"
														: "Save profile"}
												</span>
											</Button>
											<ConnectionTester />
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
											{/if}
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

<PMProjectDialog />
<PMDeleteDialog />
