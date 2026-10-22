<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	ChevronDownIcon,
	FileIcon,
	FolderIcon,
	FolderPlusIcon,
	PencilIcon,
	PlusIcon,
	TrashIcon,
	UploadIcon,
} from "@lucide/svelte";
import { profileService } from "#lib/app.svelte.js";
import ErrorAlert from "#lib/components/error-alert.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { ScrollArea } from "#lib/components/ui/scroll-area";
import type { ProfileProject } from "./profiles.svelte.js";
import {
	clearProfileForm,
	dialogState,
	loadProfileIntoForm,
	openProjectExport,
} from "./state.svelte.js";

const profileCatalog = profileService.getCatalog();

function openCreateProjectDialog() {
	dialogState.projectDialogMode = "create";
	dialogState.projectDialogProjectId = undefined;
	dialogState.projectDialogOpen = true;
}

function openRenameProjectDialog(projectId: string) {
	dialogState.projectDialogMode = "rename";
	dialogState.projectDialogProjectId = projectId;
	dialogState.projectDialogOpen = true;
}

function startNewProfile(projectId: string) {
	dialogState.selectedProjectId = projectId;
	dialogState.selectedProfileId = undefined;
	dialogState.editorMode = "new-profile";
	dialogState.originalProfile = null;
	clearProfileForm();
}

function openDeleteProjectDialog(project: ProfileProject) {
	dialogState.deleteDialogType = "project";
	dialogState.deleteDialogName = project.name;
	dialogState.deleteDialogProjectId = project.id;
	dialogState.deleteDialogProfileId = undefined;
	dialogState.deleteDialogOpen = true;
}

function handleProfileSelect(projectId: string, profileId: string) {
	const profile = profileService.find(profileId);
	if (!profile) return;
	dialogState.selectedProjectId = projectId;
	dialogState.selectedProfileId = profileId;
	dialogState.editorMode = "profile";
	loadProfileIntoForm(profile);
}
</script>

<aside
	class="flex min-h-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
>
	<div
		class="flex items-center justify-between border-b border-sidebar-border px-4 py-4"
	>
		<div>
			<p class="text-sm font-semibold text-sidebar-foreground">Projects</p>
			<p class="text-xs text-sidebar-foreground/60">
				View all of your projects and profiles.
			</p>
		</div>
		<Button
			variant="ghost"
			size="icon-sm"
			class="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
			onclick={openCreateProjectDialog}
		>
			<FolderPlusIcon class="size-4" />
			<span class="sr-only">Add project</span>
		</Button>
	</div>

	<ScrollArea class="min-h-0 flex-1">
		<div class="p-2">
			<ErrorAlert class="mb-2 text-xs" message={profileCatalog.error} />
			{#if !profileCatalog.loaded}
				<div
					class="rounded-xl border border-dashed border-sidebar-border p-4 text-sm text-sidebar-foreground/60"
				>
					Loading profiles...
				</div>
			{:else if profileCatalog.projects.length === 0}
				<div
					class="rounded-xl border border-dashed border-sidebar-border p-4 text-sm text-sidebar-foreground/60"
				>
					No projects yet. Add one to start organizing profiles.
				</div>
			{:else}
				<div class="space-y-1">
					{#each profileCatalog.projects as project (project.id)}
						<details class="group rounded-xl border border-transparent">
							<summary
								class="group/row flex cursor-default list-none items-center gap-2 rounded-xl px-2 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
							>
								<ChevronDownIcon
									class="size-4 shrink-0 text-sidebar-foreground/60 transition-transform group-open:rotate-180"
								/>
								<FolderIcon
									class="size-4 shrink-0 text-sidebar-foreground/60"
								/>
								<div class="min-w-0 flex-1">
									<p
										class="truncate text-sm font-medium text-sidebar-foreground"
									>
										{project.name}
									</p>
									<p class="text-xs text-sidebar-foreground/60">
										{project.profiles.length}
										profile{project.profiles.length === 1 ? "" : "s"}
									</p>
								</div>
								<div
									class="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover/row:opacity-100"
								>
									<Button
										variant="ghost"
										size="icon-xs"
										class="hover:bg-sidebar-foreground/10 dark:hover:bg-sidebar-foreground/10 hover:text-sidebar-accent-foreground"
										onclick={(event) => {
											event.preventDefault();
											event.stopPropagation();
											openRenameProjectDialog(project.id);
										}}
									>
										<PencilIcon class="size-3.5" />
										<span class="sr-only">Edit project</span>
									</Button>
									<Button
										variant="ghost"
										size="icon-xs"
										class="hover:bg-sidebar-foreground/10 dark:hover:bg-sidebar-foreground/10 hover:text-sidebar-accent-foreground"
										onclick={(event) => {
											event.preventDefault();
											event.stopPropagation();
											startNewProfile(project.id);
										}}
									>
										<PlusIcon class="size-3.5" />
										<span class="sr-only">Add profile</span>
									</Button>
									<Button
										variant="ghost"
										size="icon-xs"
										class="hover:bg-sidebar-foreground/10 dark:hover:bg-sidebar-foreground/10 hover:text-sidebar-accent-foreground"
										onclick={(event) => {
											event.preventDefault();
											event.stopPropagation();
											openProjectExport(project);
										}}
									>
										<UploadIcon class="size-3.5" />
										<span class="sr-only">Export project</span>
									</Button>
									<Button
										variant="ghost"
										size="icon-xs"
										class="hover:bg-destructive/10 dark:hover:bg-destructive/10 hover:text-destructive dark:hover:text-destructive"
										onclick={(event) => {
											event.preventDefault();
											event.stopPropagation();
											openDeleteProjectDialog(project);
										}}
									>
										<TrashIcon class="size-3.5" />
										<span class="sr-only">Delete project</span>
									</Button>
								</div>
							</summary>

							<div class="space-y-1 px-2 pb-2 pl-8">
								{#if project.profiles.length === 0}
									<div
										class="rounded-lg px-2 py-1 text-xs text-sidebar-foreground/60"
									>
										No profiles yet
									</div>
								{:else}
									{#each project.profiles as profile (profile.id)}
										<button
											type="button"
											class={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${dialogState.selectedProfileId === profile.id ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
											onclick={() =>
												handleProfileSelect(project.id, profile.id)}
										>
											<div class="flex min-w-0 flex-1 items-center gap-2">
												<FileIcon
													class="size-3.5 shrink-0 text-sidebar-foreground/60"
												/>
												<span class="truncate">{profile.name}</span>
											</div>
											<span
												class="rounded-full border border-sidebar-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-sidebar-foreground/60"
											>
												{profile.mode}
											</span>
										</button>
									{/each}
								{/if}
							</div>
						</details>
					{/each}
				</div>
			{/if}
		</div>
	</ScrollArea>
</aside>
