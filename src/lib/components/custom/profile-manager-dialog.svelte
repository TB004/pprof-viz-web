<script lang="ts">
import {
	CheckIcon,
	ChevronDownIcon,
	FileIcon,
	FolderIcon,
	FolderPlusIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
} from "@lucide/svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import Input from "$lib/components/ui/input/input.svelte";
import * as CollectionService from "$lib/services/collection_service.js";
import * as ProfileService from "$lib/services/profile_service.js";

type EditorMode = "profile" | "new-profile";
type ProjectDialogMode = "create" | "rename";

type Props = {
	open?: boolean;
};

let { open = $bindable(false) }: Props = $props();

let selectedProjectId = $state<string | undefined>(undefined);
let selectedProfileId = $state<string | undefined>(undefined);
let editorMode = $state<EditorMode>("profile");
let profileName = $state("");
let profileUrl = $state("");
let profileMode = $state(ProfileService.CollectionType.Stream);
let projectDialogOpen = $state(false);
let projectDialogMode = $state<ProjectDialogMode>("create");
let projectDialogName = $state("");
let projectDialogProjectId = $state<string | undefined>(undefined);
let deleteDialogOpen = $state(false);
let deleteDialogType = $state<"project" | "profile">("project");
let deleteDialogName = $state("");
let deleteDialogProjectId = $state<string | undefined>(undefined);
let deleteDialogProfileId = $state<string | undefined>(undefined);

const profileCatalog = ProfileService.profileCatalog;
const profileProjects = ProfileService.profileProjects;

const modeOptions: Array<{
	value: ProfileService.CollectionType;
	title: string;
	description: string;
}> = [
	{
		value: ProfileService.CollectionType.Snapshot,
		title: "Snapshot",
		description: "Capture a focused point-in-time profile.",
	},
	{
		value: ProfileService.CollectionType.Stream,
		title: "Stream",
		description: "Continuously follow runtime changes.",
	},
];

function clearProfileForm() {
	profileName = "";
	profileUrl = "";
	profileMode = ProfileService.CollectionType.Stream;
}

function clearProjectDialog() {
	projectDialogName = "";
	projectDialogProjectId = undefined;
	projectDialogMode = "create";
}

function openCreateProjectDialog() {
	clearProjectDialog();
	projectDialogOpen = true;
}

function openRenameProjectDialog(projectId: string) {
	const project = $profileProjects.find((entry) => entry.id === projectId);
	if (!project) {
		return;
	}

	projectDialogMode = "rename";
	projectDialogProjectId = projectId;
	projectDialogName = project.name;
	projectDialogOpen = true;
}

async function saveProjectDialog() {
	const trimmedName = projectDialogName.trim();
	if (!trimmedName) {
		return;
	}

	if (projectDialogMode === "create") {
		const createdProjectId = await ProfileService.createProject(trimmedName);
		if (createdProjectId) {
			selectedProjectId = createdProjectId;
			selectedProfileId = undefined;
			editorMode = "profile";
			clearProfileForm();
		}
	} else if (projectDialogProjectId) {
		await ProfileService.renameProject(projectDialogProjectId, trimmedName);
	}

	projectDialogOpen = false;
	clearProjectDialog();
}

$effect(() => {
	if (!open) {
		return;
	}

	selectedProjectId = undefined;
	selectedProfileId = undefined;
	editorMode = "profile";
	clearProfileForm();
	projectDialogOpen = false;
	clearProjectDialog();
});

function handleProfileSelect(projectId: string, profileId: string) {
	selectedProjectId = projectId;
	selectedProfileId = profileId;
	editorMode = "profile";

	const snapshot = ProfileService.getProfileById(profileId);
	profileName = snapshot?.profile.name ?? "";
	profileUrl = snapshot?.profile.url ?? "";
	profileMode = snapshot?.profile.mode ?? ProfileService.CollectionType.Stream;

	void CollectionService.selectProfile(profileId);
}

function startNewProfile(projectId: string) {
	selectedProjectId = projectId;
	selectedProfileId = undefined;
	editorMode = "new-profile";
	clearProfileForm();
}

async function saveProfile() {
	if (!selectedProjectId) {
		return;
	}

	const payload = {
		name: profileName,
		url: profileUrl,
		mode: profileMode,
	};

	if (editorMode === "new-profile") {
		const createdProfileId = await ProfileService.createProfile(
			selectedProjectId,
			payload,
		);
		if (createdProfileId) {
			selectedProfileId = undefined;
			editorMode = "new-profile";
			clearProfileForm();
		}
		return;
	}

	if (!selectedProfileId) {
		return;
	}

	await ProfileService.updateProfile(selectedProfileId, payload);
	await CollectionService.selectProfile(selectedProfileId);
}

async function deleteProject(projectId: string) {
	const project = $profileProjects.find((entry) => entry.id === projectId);
	if (!project) {
		return;
	}

	deleteDialogType = "project";
	deleteDialogName = project.name;
	deleteDialogProjectId = projectId;
	deleteDialogProfileId = undefined;
	deleteDialogOpen = true;
}

async function deleteProfile(profileId: string) {
	const profile = ProfileService.getProfileById(profileId);
	if (!profile) {
		return;
	}

	deleteDialogType = "profile";
	deleteDialogName = profile.profile.name;
	deleteDialogProjectId = undefined;
	deleteDialogProfileId = profileId;
	deleteDialogOpen = true;
}

async function confirmDeleteDialog() {
	if (deleteDialogType === "project") {
		if (!deleteDialogProjectId) {
			return;
		}

		await ProfileService.deleteProject(deleteDialogProjectId);

		if (selectedProjectId === deleteDialogProjectId) {
			selectedProjectId = undefined;
			selectedProfileId = undefined;
			editorMode = "profile";
			clearProfileForm();
		}
	} else {
		if (!deleteDialogProfileId) {
			return;
		}

		await ProfileService.deleteProfile(deleteDialogProfileId);

		if (selectedProfileId === deleteDialogProfileId) {
			selectedProfileId = undefined;
			editorMode = "profile";
			clearProfileForm();
		}
	}

	deleteDialogOpen = false;
	deleteDialogType = "project";
	deleteDialogName = "";
	deleteDialogProjectId = undefined;
	deleteDialogProfileId = undefined;
}

$effect(() => {
	if (selectedProfileId && !ProfileService.getProfileById(selectedProfileId)) {
		selectedProfileId = undefined;
		editorMode = "profile";
		clearProfileForm();
	}
});
</script>

<Dialog.Root bind:open={open}>
	<Dialog.Content class="sm:max-w-[min(96vw,72rem)] max-h-[88vh] p-0 overflow-hidden border-border/70 bg-background shadow-2xl">
		<div class="grid max-h-[88vh] min-h-0 grid-cols-1 overflow-hidden md:grid-cols-[18rem_minmax(0,1fr)]">
			<aside class="flex min-h-0 flex-col border-r border-border/60 bg-muted/20">
				<div class="flex items-center justify-between border-b border-border/60 px-4 py-4">
					<div>
						<p class="text-sm font-semibold text-foreground">Projects</p>
						<p class="text-xs text-muted-foreground">View all of your projects and profiles.</p>
					</div>
					<Button variant="ghost" size="icon-sm" onclick={openCreateProjectDialog}>
						<FolderPlusIcon class="size-4" />
						<span class="sr-only">Add project</span>
					</Button>
				</div>

				<div class="min-h-0 flex-1 overflow-auto p-2">
					{#if !$profileCatalog.loaded}
						<div class="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
							Loading profiles...
						</div>
					{:else if $profileProjects.length === 0}
						<div class="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
							No projects yet. Add one to start organizing profiles.
						</div>
					{:else}
						<div class="space-y-1">
							{#each $profileProjects as project (project.id)}
								<details class="group rounded-xl border border-transparent bg-background/70">
									<summary class="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted/50">
										<ChevronDownIcon class="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
										<FolderIcon class="size-4 shrink-0 text-muted-foreground" />
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium text-foreground">{project.name}</p>
											<p class="text-xs text-muted-foreground">{project.profiles.length} profile{project.profiles.length === 1 ? "" : "s"}</p>
										</div>
										<div class="ml-auto flex items-center gap-1">
											<Button
												variant="ghost"
												size="icon-xs"
												onclick={async (event) => {
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
												onclick={async (event) => {
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
												onclick={async (event) => {
													event.preventDefault();
													event.stopPropagation();
													await deleteProject(project.id);
												}}
											>
												<Trash2Icon class="size-3.5" />
												<span class="sr-only">Delete project</span>
											</Button>
										</div>
									</summary>

									<div class="space-y-1 px-2 pb-2 pl-8">
										{#if project.profiles.length === 0}
											<div class="rounded-lg px-2 py-1 text-xs text-muted-foreground">No profiles yet</div>
										{:else}
											{#each project.profiles as profile (profile.id)}
												<button
													type="button"
													class={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${selectedProfileId === profile.id ? "bg-primary/10 text-primary" : "hover:bg-muted/60"}`}
													onclick={() => handleProfileSelect(project.id, profile.id)}
												>
													<div class="flex min-w-0 flex-1 items-center gap-2">
														<FileIcon class="size-3.5 shrink-0 text-muted-foreground" />
														<span class="truncate">{profile.name}</span>
													</div>
													<span class="rounded-full border border-border/60 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
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
			</aside>

			<section class="min-h-0 overflow-hidden">
				<div class="flex h-full min-h-0 flex-col">
					<Dialog.Header class="border-b border-border/60 px-6 py-5">
						<Dialog.Title class="text-xl font-semibold">Profile Configurations</Dialog.Title>
						<Dialog.Description>
							Create, delete or edit locally stored collection profiles.
						</Dialog.Description>
					</Dialog.Header>

					<div class="min-h-0 flex-1 overflow-auto px-6 py-6">
						{#if editorMode === "new-profile" || selectedProfileId}
							<div class="mx-auto max-w-xl space-y-6">
								<div>
									<p class="text-sm font-medium text-muted-foreground">
										{#if editorMode === "new-profile"}
											New profile
										{:else}
											Selected profile
										{/if}
									</p>
									<h3 class="text-2xl font-semibold tracking-tight">
										{#if editorMode === "new-profile"}
											Create profile
										{:else}
											{profileName || "Untitled profile"}
										{/if}
									</h3>
								</div>

								<div class="space-y-6">
									<label class="block">
										<span class="mb-3 block text-sm font-medium text-foreground">Profile name</span>
										<Input bind:value={profileName} placeholder="Production pprof" />
									</label>

									<label class="block">
										<span class="mb-3 block text-sm font-medium text-foreground">URL</span>
										<Input bind:value={profileUrl} placeholder="http://localhost:9090" />
									</label>

									<div>
										<p class="mb-3 text-sm font-medium text-foreground">Mode</p>
										<div class="grid gap-3 sm:grid-cols-2">
											{#each modeOptions as option (option.value)}
												<button
													type="button"
													class={`rounded-2xl border p-4 text-left transition-colors ${profileMode === option.value ? "border-primary bg-primary/5" : "border-border/70 bg-muted/25 hover:border-primary/30"}`}
													onclick={() => (profileMode = option.value)}
												>
													<div class="flex items-start justify-between gap-3">
														<div>
															<p class="text-base font-semibold text-foreground">{option.title}</p>
															<p class="mt-1 text-sm text-muted-foreground">{option.description}</p>
														</div>
														<div class={`flex size-5 items-center justify-center rounded-full border ${profileMode === option.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>
															{#if profileMode === option.value}
																<CheckIcon class="size-3.5" />
															{/if}
														</div>
													</div>
												</button>
											{/each}
										</div>
									</div>

									<div class="flex flex-wrap items-center justify-between gap-3 pt-2">
										<div class="flex flex-wrap gap-2">
											<Button variant="default" onclick={saveProfile}>
												<CheckIcon class="size-4" />
												<span>{editorMode === "new-profile" ? "Create profile" : "Save profile"}</span>
											</Button>
											{#if selectedProfileId}
												{@const activeProfileId = selectedProfileId}
												<Button variant="destructive" onclick={() => deleteProfile(activeProfileId)}>
													<Trash2Icon class="size-4" />
													<span>Delete</span>
												</Button>
											{/if}
										</div>
									</div>
								</div>
						</div>
						{:else}
							<div class="flex h-113 items-center justify-center">
								<div class="max-w-sm text-center">
									<p class="text-sm font-medium text-foreground">Select a profile or create a new one</p>
									<p class="mt-2 text-sm text-muted-foreground">
										Use the sidebar on the left to add a profile to a project, or select an existing profile to edit it or view its details.
									</p>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={projectDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{projectDialogMode === "create" ? "Create project" : "Rename project"}</Dialog.Title>
			<Dialog.Description>
				{projectDialogMode === "create"
					? "Enter a project name before adding profiles."
					: "Update the project name and save the change."}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 px-6 pb-6">
			<label class="block">
				<span class="mb-3 block text-sm font-medium text-foreground">Project name</span>
				<Input bind:value={projectDialogName} placeholder="Production" />
			</label>

			<div class="flex flex-wrap justify-end gap-2 pt-2">
				<Button
					variant="outline"
					onclick={() => {
						projectDialogOpen = false;
						clearProjectDialog();
					}}
				>
					Cancel
				</Button>
				<Button variant="default" onclick={saveProjectDialog}>
					{projectDialogMode === "create" ? "Create" : "Save"}
				</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{deleteDialogType === "project" ? "Delete project" : "Delete profile"}
			</Dialog.Title>
			<Dialog.Description>
				{deleteDialogType === "project"
					? `Delete ${deleteDialogName} and every profile inside it. This cannot be undone.`
					: `Delete ${deleteDialogName}. This cannot be undone.`}
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-wrap justify-end gap-2 px-6 pb-6">
			<Button
				variant="outline"
				onclick={() => {
					deleteDialogOpen = false;
					deleteDialogType = "project";
					deleteDialogName = "";
					deleteDialogProjectId = undefined;
					deleteDialogProfileId = undefined;
				}}
			>
				Cancel
			</Button>
			<Button variant="destructive" onclick={confirmDeleteDialog}>Delete</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
