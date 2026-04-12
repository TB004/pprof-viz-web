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
import { CollectionService, ProfileService } from "$lib/services";
import type { ProfileProject } from "$lib/services/profile_service";
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
function handleProfileSelect(projectId: string, profileId: string) {
	dialogState.selectedProjectId = projectId;
	dialogState.selectedProfileId = profileId;
	dialogState.editorMode = "profile";

	const snapshot = ProfileService.getProfileById(profileId);
	dialogState.profileName = snapshot?.profile.name ?? "";
	dialogState.profileUrl = snapshot?.profile.url ?? "";
	dialogState.profileMode =
		snapshot?.profile.mode ?? ProfileService.CollectionType.Stream;

	void CollectionService.selectProfile(profileId);
}
</script>

<details class="group rounded-xl border border-transparent bg-background/70">
	<summary
		class="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted/50"
	>
		<ChevronDownIcon
			class="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
		/>
		<FolderIcon class="size-4 shrink-0 text-muted-foreground" />
		<div class="min-w-0 flex-1">
			<p class="truncate text-sm font-medium text-foreground">{project.name}</p>
			<p class="text-xs text-muted-foreground">
				{project.profiles.length}
				profile{project.profiles.length === 1 ? "" : "s"}
			</p>
		</div>
		<div class="ml-auto flex items-center gap-1">
			<Button
				variant="ghost"
				size="icon-xs"
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
				class="text-muted-foreground hover:text-destructive"
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
			<div class="rounded-lg px-2 py-1 text-xs text-muted-foreground">
				No profiles yet
			</div>
		{:else}
			{#each project.profiles as profile (profile.id)}
				<button
					type="button"
					class={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${dialogState.selectedProfileId === profile.id ? "bg-primary/10 text-primary" : "hover:bg-muted/60"}`}
					onclick={() => handleProfileSelect(project.id, profile.id)}
				>
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<FileIcon class="size-3.5 shrink-0 text-muted-foreground" />
						<span class="truncate">{profile.name}</span>
					</div>
					<span
						class="rounded-full border border-border/60 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground"
					>
						{profile.mode}
					</span>
				</button>
			{/each}
		{/if}
	</div>
</details>
