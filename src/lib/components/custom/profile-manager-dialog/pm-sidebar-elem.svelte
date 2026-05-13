<script lang="ts">
import {
	ChevronDownIcon,
	FileIcon,
	FolderIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
} from "@lucide/svelte";
import { get } from "svelte/store";
import { Button } from "$lib/components/ui/button/index.js";
import { ProfileService } from "$lib/services";
import type { ProfileProject } from "$lib/services/profile_service";
import { CollectionType } from "$lib/types";
import { clearProfileForm, dialogState } from "./state.svelte.ts";

type Props = {
	project: ProfileProject;
};

let { project }: Props = $props();

function openRenameProjectDialog(projectId: string) {
	dialogState.projectDialogMode = "rename";
	dialogState.projectDialogProjectId = projectId;
	dialogState.projectDialogOpen = true;
}

function startNewProfile(projectId: string) {
	dialogState.selectedProjectId = projectId;
	dialogState.selectedProfileId = undefined;
	dialogState.editorMode = "new-profile";
	clearProfileForm();
}

function openDeleteProjectDialog(projectId: string) {
	const project = get(ProfileService.profileProjects).find(
		(entry) => entry.id === projectId,
	);
	if (!project) {
		return;
	}

	dialogState.deleteDialogType = "project";
	dialogState.deleteDialogName = project.name;
	dialogState.deleteDialogProjectId = projectId;
	dialogState.deleteDialogProfileId = undefined;
	dialogState.deleteDialogOpen = true;
}

// When a profile is selected, we need to update the dialog state with the selected
// profile's information and switch to the profile editor mode.
async function handleProfileSelect(projectId: string, profileId: string) {
	dialogState.selectedProjectId = projectId;
	dialogState.selectedProfileId = profileId;
	dialogState.editorMode = "profile";

	const snapshot = await ProfileService.getProfileById(profileId);

	// Discard the result if the user selected a different profile while we were awaiting.
	if (
		dialogState.selectedProfileId !== profileId ||
		dialogState.selectedProjectId !== projectId
	) {
		return;
	}

	dialogState.profileName = snapshot?.name ?? "";
	dialogState.profileUrl = snapshot?.url ?? "";
	dialogState.profileMode = snapshot?.mode ?? CollectionType.Stream;
	dialogState.profileToken = snapshot?.token ?? "";
	dialogState.profileIntervalSeconds = snapshot?.intervalSeconds ?? 1;
	dialogState.profileNumberOfCycles = snapshot?.numberOfCycles ?? 0;
}
</script>

<details class="group rounded-xl border border-transparent">
	<summary
		class="group/row flex cursor-default list-none items-center gap-2 rounded-xl px-2 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
	>
		<ChevronDownIcon
			class="size-4 shrink-0 text-sidebar-foreground/60 transition-transform group-open:rotate-180"
		/>
		<FolderIcon class="size-4 shrink-0 text-sidebar-foreground/60" />
		<div class="min-w-0 flex-1">
			<p class="truncate text-sm font-medium text-sidebar-foreground">
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
				class="hover:bg-destructive/10 dark:hover:bg-destructive/10 hover:text-destructive dark:hover:text-destructive"
				onclick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openDeleteProjectDialog(project.id);
                }}
			>
				<Trash2Icon class="size-3.5" />
				<span class="sr-only">Delete project</span>
			</Button>
		</div>
	</summary>

	<div class="space-y-1 px-2 pb-2 pl-8">
		{#if project.profiles.length === 0}
			<div class="rounded-lg px-2 py-1 text-xs text-sidebar-foreground/60">
				No profiles yet
			</div>
		{:else}
			{#each project.profiles as profile (profile.id)}
				<button
					type="button"
					class={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${dialogState.selectedProfileId === profile.id ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
					onclick={() => handleProfileSelect(project.id, profile.id)}
				>
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<FileIcon class="size-3.5 shrink-0 text-sidebar-foreground/60" />
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
