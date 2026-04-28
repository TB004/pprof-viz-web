<script lang="ts">
import {
	CheckIcon,
	CircleCheckIcon,
	CircleXIcon,
	LoaderCircleIcon,
	PlugZapIcon,
	Trash2Icon,
} from "@lucide/svelte";
import {
	PMDeleteDialog,
	PMProjectDialog,
	PMSidebar,
} from "$lib/components/custom/profile-manager-dialog";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import Input from "$lib/components/ui/input/input.svelte";
import { AgentService, ProfileService } from "$lib/services";
import { clearProfileForm, dialogState } from "./state.svelte.ts";

type Props = {
	open?: boolean;
};

let { open = $bindable(false) }: Props = $props();

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

function openDeleteProfileDialog(profileId?: string) {
	if (!profileId) {
		return;
	}
	const profile = ProfileService.getProfileById(profileId);
	if (!profile) {
		return;
	}

	dialogState.deleteDialogType = "profile";
	dialogState.deleteDialogName = profile.profile.name;
	dialogState.deleteDialogProjectId = undefined;
	dialogState.deleteDialogProfileId = profileId;
	dialogState.deleteDialogOpen = true;
}

// Save profile changes to the service, and select the profile in the collection state if successful
async function saveProfile() {
	if (!dialogState.selectedProjectId) {
		return;
	}

	const isStream =
		dialogState.profileMode === ProfileService.CollectionType.Stream;
	const payload = {
		name: dialogState.profileName,
		url: dialogState.profileUrl,
		mode: dialogState.profileMode,
		token: dialogState.profileToken || undefined,
		intervalSeconds: isStream ? dialogState.profileIntervalSeconds : undefined,
		numberOfCycles: isStream ? dialogState.profileNumberOfCycles : undefined,
	};

	if (dialogState.editorMode === "new-profile") {
		const createdProfileId = await ProfileService.createProfile(
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

	await ProfileService.updateProfile(dialogState.selectedProfileId, payload);
}

type PingStatus = "idle" | "pending" | "success" | "error";

let pingStatus = $state<PingStatus>("idle");
let pingError = $state("");
let pingResetTimer: ReturnType<typeof setTimeout> | undefined;

// Reset the ping result whenever the URL changes so stale indicators don't persist.
$effect(() => {
	const _url = dialogState.profileUrl;
	pingStatus = "idle";
	pingError = "";
});

async function testConnection() {
	const url = dialogState.profileUrl.trim();
	if (!url) {
		return;
	}

	try {
		new URL(url);
	} catch {
		pingStatus = "error";
		pingError = "Invalid URL format";
		return;
	}

	clearTimeout(pingResetTimer);
	pingStatus = "pending";
	pingError = "";

	try {
		const agent = new AgentService(url);
		await agent.ping();
		pingStatus = "success";
	} catch (err) {
		pingStatus = "error";
		pingError = err instanceof Error ? err.message : "Connection failed";
	}

	pingResetTimer = setTimeout(() => {
		pingStatus = "idle";
		pingError = "";
	}, 4000);
}
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

					<div class="min-h-0 flex-1 overflow-auto px-6 py-6">
						{#if dialogState.editorMode === "new-profile" || dialogState.selectedProfileId}
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
											{dialogState.profileName ||
                                                "Untitled profile"}
										{/if}
									</h3>
								</div>

								<div class="space-y-6">
									<label class="block">
										<span class="mb-3 block text-sm font-medium text-foreground"
											>Profile name</span
										>
										<Input
											bind:value={dialogState.profileName}
											placeholder="Production pprof"
										/>
									</label>

									<label class="block">
										<span class="mb-3 block text-sm font-medium text-foreground"
											>URL</span
										>
										<Input
											bind:value={dialogState.profileUrl}
											placeholder="http://localhost:9090"
										/>
									</label>

									<label class="block">
										<span class="mb-3 block text-sm font-medium text-foreground"
											>Auth token
											<span class="ml-1 font-normal text-muted-foreground"
												>(optional)</span
											></span
										>
										<Input
											bind:value={dialogState.profileToken}
											placeholder="Bearer eyJ..."
											type="password"
										/>
									</label>

									<div>
										<p class="mb-3 text-sm font-medium text-foreground">Mode</p>
										<div class="grid gap-3 sm:grid-cols-2">
											{#each modeOptions as option (option.value)}
												<button
													type="button"
													class={`rounded-2xl border p-4 text-left transition-colors ${dialogState.profileMode === option.value ? "border-primary bg-primary/5" : "border-border/70 bg-muted/25 hover:border-primary/30"}`}
													onclick={() =>
                                                        (dialogState.profileMode =
                                                            option.value)}
												>
													<div class="flex items-start justify-between gap-3">
														<div>
															<p
																class="text-base font-semibold text-foreground"
															>
																{option.title}
															</p>
															<p class="mt-1 text-sm text-muted-foreground">
																{option.description}
															</p>
														</div>
														<div
															class={`flex w-6 h-5 items-center justify-center rounded-full border ${dialogState.profileMode === option.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
														>
															{#if dialogState.profileMode === option.value}
																<CheckIcon class="size-3.5" />
															{/if}
														</div>
													</div>
												</button>
											{/each}
										</div>
									</div>

									{#if dialogState.profileMode === ProfileService.CollectionType.Stream}
										<div class="grid gap-4 sm:grid-cols-2">
											<label class="block">
												<span
													class="mb-3 block text-sm font-medium text-foreground"
													>Interval
													<span class="ml-1 font-normal text-muted-foreground"
														>(seconds)</span
													></span
												>
												<Input
													type="number"
													min={1}
													step={1}
													bind:value={dialogState.profileIntervalSeconds}
												/>
											</label>
											<label class="block">
												<span
													class="mb-3 block text-sm font-medium text-foreground"
													>Cycles
													<span class="ml-1 font-normal text-muted-foreground"
														>(0 = infinite)</span
													></span
												>
												<Input
													type="number"
													min={0}
													step={1}
													bind:value={dialogState.profileNumberOfCycles}
												/>
											</label>
										</div>
									{/if}

									<div class="space-y-3 pt-2">
										{#if pingStatus === "error" && pingError}
											<p class="text-sm text-destructive">{pingError}</p>
										{/if}
										<div
											class="flex flex-wrap items-center justify-between gap-3"
										>
											<div class="flex flex-wrap gap-2">
												<Button variant="default" onclick={saveProfile}>
													<CheckIcon class="size-4" />
													<span
														>{dialogState.editorMode ===
                                                    "new-profile"
                                                        ? "Create profile"
                                                        : "Save profile"}</span
													>
												</Button>
												<Button
													variant="outline"
													disabled={pingStatus === "pending" || !dialogState.profileUrl.trim()}
													class={pingStatus === "success"
													? "border-green-500/40 bg-green-500/10 text-green-600 hover:bg-green-500/15 hover:text-green-600"
													: pingStatus === "error"
														? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
														: ""}
													onclick={testConnection}
												>
													{#if pingStatus === "pending"}
														<LoaderCircleIcon class="size-4 animate-spin" />
														<span>Testing...</span>
													{:else if pingStatus === "success"}
														<CircleCheckIcon class="size-4" />
														<span>Connected</span>
													{:else if pingStatus === "error"}
														<CircleXIcon class="size-4" />
														<span>Unreachable</span>
													{:else}
														<PlugZapIcon class="size-4" />
														<span>Test connection</span>
													{/if}
												</Button>
												{#if dialogState.selectedProfileId}
													<Button
														variant="destructive"
														onclick={() =>
														openDeleteProfileDialog(
															dialogState.selectedProfileId,
														)}
													>
														<Trash2Icon class="size-4" />
														<span>Delete</span>
													</Button>
												{/if}
											</div>
										</div>
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
				</div>
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>

<PMProjectDialog />
<PMDeleteDialog />
