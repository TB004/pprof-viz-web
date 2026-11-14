<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	CheckIcon,
	ChevronRightIcon,
	FolderIcon,
	FolderPlusIcon,
	PencilIcon,
	PlugIcon,
	PlusIcon,
	TrashIcon,
	UploadIcon,
} from "@lucide/svelte";
import { profileService } from "#lib/app.svelte.js";
import Chip from "#lib/components/chip.svelte";
import ErrorAlert from "#lib/components/error-alert.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import Input from "#lib/components/ui/input/input.svelte";
import { ScrollArea } from "#lib/components/ui/scroll-area";
import { Task } from "#lib/task.svelte.js";
import type { ProfileProject } from "./profiles.svelte.js";
import {
	dialogState,
	editProfile,
	openProjectExport,
	startNewProfile,
} from "./state.svelte.js";

const profileCatalog = profileService.getCatalog();
const creating = new Task();

let collapsed = $state<Record<string, boolean>>({});
let newOpen = $state(false);
let newName = $state("");

const profileCount = $derived(
	profileCatalog.projects.reduce((sum, p) => sum + p.profiles.length, 0),
);

// With nothing to pick from, creating a project is the only thing to do.
$effect(() => {
	if (profileCatalog.loaded && profileCatalog.projects.length === 0) {
		newOpen = true;
	}
});

function plural(n: number, word: string): string {
	return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function openNewProject() {
	creating.reset();
	newName = "";
	newOpen = true;
}

async function createProject() {
	const name = newName;
	await creating.run(async () => {
		const id = await profileService.createProject(name);
		collapsed = { ...collapsed, [id]: false };
		newOpen = false;
		newName = "";
		startNewProfile(id);
	});
}

function onNewKey(event: KeyboardEvent) {
	if (event.key === "Enter") void createProject();
	if (event.key === "Escape") {
		event.stopPropagation();
		newOpen = false;
	}
}

function openRenameProjectDialog(projectId: string) {
	dialogState.projectDialogMode = "rename";
	dialogState.projectDialogProjectId = projectId;
	dialogState.projectDialogOpen = true;
}

function addProfile(projectId: string) {
	collapsed = { ...collapsed, [projectId]: false };
	startNewProfile(projectId);
}

function openDeleteProjectDialog(project: ProfileProject) {
	dialogState.deleteDialogType = "project";
	dialogState.deleteDialogName = project.name;
	dialogState.deleteDialogProjectId = project.id;
	dialogState.deleteDialogProfileId = undefined;
	dialogState.deleteDialogOpen = true;
}
</script>

<aside
	class="border-line bg-sidebar flex min-h-0 flex-col border-r max-md:max-h-[40vh] max-md:border-r-0 max-md:border-b"
>
	<div
		class="border-line flex items-center gap-2 border-b pt-[18px] pr-3.5 pb-3 pl-[18px]"
	>
		<div class="flex-1">
			<div class="text-[15px] font-[650]">Projects</div>
			<div class="text-muted-foreground text-xs">
				{plural(profileCatalog.projects.length, "project")}
				· {plural(profileCount, "profile")}
			</div>
		</div>
		<Button
			variant="outline"
			size="icon-sm"
			aria-label="New project"
			onclick={openNewProject}
		>
			<FolderPlusIcon />
		</Button>
	</div>

	<ScrollArea class="min-h-0 flex-1">
		<div class="p-2">
			<ErrorAlert class="mb-2 text-xs" message={profileCatalog.error} />

			{#if newOpen}
				<div class="flex flex-col gap-2 px-1 pt-1 pb-2.5">
					<div class="flex gap-1.5">
						<label for="new-project-name" class="sr-only">Project name</label>
						<Input
							id="new-project-name"
							class="h-[34px]"
							placeholder="Project name"
							bind:value={newName}
							onkeydown={onNewKey}
						/>
						<Button
							size="icon-sm"
							class="size-[34px]"
							aria-label="Create project"
							disabled={!newName.trim() || creating.pending}
							onclick={createProject}
						>
							<CheckIcon />
						</Button>
					</div>
					<ErrorAlert class="text-xs" message={creating.error} />
				</div>
			{/if}

			{#if !profileCatalog.loaded}
				<p class="text-muted-foreground p-3 text-[13px]">Loading profiles…</p>
			{:else if profileCatalog.projects.length === 0}
				<div
					class="border-line-2 text-muted-foreground m-1.5 rounded-xl border border-dashed p-4 text-[13px]"
				>
					No projects yet. A project groups the profiles of one service.
				</div>
			{/if}

			{#each profileCatalog.projects as project (project.id)}
				{@const open = !collapsed[project.id]}
				<div class="group/row flex items-center gap-0.5 rounded-control">
					<button
						type="button"
						aria-expanded={open}
						class="text-ink hover:bg-hover flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control p-2 text-left"
						onclick={() => (collapsed = { ...collapsed, [project.id]: open })}
					>
						<ChevronRightIcon
							class="text-muted-foreground size-3.5 shrink-0 transition-transform {open
								? "rotate-90"
								: ""}"
						/>
						<FolderIcon class="text-muted-foreground size-4 shrink-0" />
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-[13.5px] font-[550]"
								>{project.name}</span
							>
							<span class="text-muted-foreground text-[11.5px]">
								{plural(project.profiles.length, "profile")}
							</span>
						</span>
					</button>
					<span
						class="flex max-w-0 gap-0.5 overflow-hidden group-focus-within/row:max-w-none group-hover/row:max-w-none max-md:max-w-none"
					>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Add profile to {project.name}"
							onclick={() => addProfile(project.id)}
						>
							<PlusIcon />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Rename {project.name}"
							onclick={() => openRenameProjectDialog(project.id)}
						>
							<PencilIcon />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Export {project.name}"
							onclick={() => openProjectExport(project)}
						>
							<UploadIcon />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							class="text-bad hover:text-bad"
							aria-label="Delete {project.name}"
							onclick={() => openDeleteProjectDialog(project)}
						>
							<TrashIcon />
						</Button>
					</span>
				</div>

				{#if open}
					{#each project.profiles as profile (profile.id)}
						{@const on = dialogState.selectedProfileId === profile.id}
						<button
							type="button"
							aria-current={on ? "true" : undefined}
							class="text-ink-2 hover:bg-hover hover:text-ink aria-[current=true]:bg-sel aria-[current=true]:text-ink flex w-full cursor-pointer items-center gap-2 rounded-lg py-[7px] pr-2 pl-[34px] text-left text-[13px] aria-[current=true]:font-semibold"
							onclick={() => editProfile(profile)}
						>
							<PlugIcon class="text-muted-foreground size-3.5 shrink-0" />
							<span class="flex-1 truncate">{profile.name}</span>
							<Chip>{profile.mode}</Chip>
						</button>
					{:else}
						<div
							class="text-muted-foreground pt-1.5 pr-2 pb-2.5 pl-[34px] text-[12.5px]"
						>
							No profiles yet
						</div>
					{/each}
				{/if}
			{/each}
		</div>
	</ScrollArea>
</aside>
