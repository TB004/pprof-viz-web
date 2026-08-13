<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	CheckIcon,
	CircleCheckIcon,
	CircleXIcon,
	EyeIcon,
	EyeOffIcon,
	LoaderCircleIcon,
	PlugZapIcon,
	Trash2Icon,
} from "@lucide/svelte";
import { ModePicker, UrlField } from "$lib/components/custom/profile-form";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import Input from "$lib/components/ui/input/input.svelte";
import * as ScrollArea from "$lib/components/ui/scroll-area/index.js";
import * as Select from "$lib/components/ui/select/index.js";
import Ipc from "$lib/ipc";
import { ProfileService } from "$lib/services";
import { CollectionType, HttpVersion } from "$lib/types";
import PMDeleteDialog from "./pm-delete-dialog.svelte";
import PMProjectDialog from "./pm-project-dialog.svelte";
import PMSidebar from "./pm-sidebar.svelte";
import { assembleUrl, clearProfileForm, dialogState } from "./state.svelte.ts";

type Props = {
	open?: boolean;
};

let { open = $bindable(false) }: Props = $props();

// When HTTP/3 is selected, force the scheme to https.
$effect(() => {
	if (dialogState.profileHttpVersion === HttpVersion.Http3) {
		dialogState.profileScheme = "https";
	}
});

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
	const profile = await ProfileService.getProfileById(profileId);
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
		httpVersion: dialogState.profileHttpVersion,
		token: dialogState.profileToken || null,
		allowInsecureTls: dialogState.profileAllowInsecureTls,
		intervalSeconds: isStream ? dialogState.profileIntervalSeconds : null,
		numberOfCycles: isStream ? dialogState.profileNumberOfCycles : null,
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

	dialogState.originalProfile = {
		name: dialogState.profileName,
		scheme: dialogState.profileScheme,
		urlHost: dialogState.profileUrlHost,
		mode: dialogState.profileMode,
		httpVersion: dialogState.profileHttpVersion,
		token: dialogState.profileToken,
		allowInsecureTls: dialogState.profileAllowInsecureTls,
		intervalSeconds: dialogState.profileIntervalSeconds,
		numberOfCycles: dialogState.profileNumberOfCycles,
	};
}

type PingStatus = "idle" | "pending" | "success" | "error";

const hasChanges = $derived(
	dialogState.editorMode === "new-profile" ||
		!dialogState.originalProfile ||
		dialogState.profileName !== dialogState.originalProfile.name ||
		dialogState.profileScheme !== dialogState.originalProfile.scheme ||
		dialogState.profileUrlHost !== dialogState.originalProfile.urlHost ||
		dialogState.profileMode !== dialogState.originalProfile.mode ||
		dialogState.profileHttpVersion !==
			dialogState.originalProfile.httpVersion ||
		dialogState.profileToken !== dialogState.originalProfile.token ||
		dialogState.profileAllowInsecureTls !==
			dialogState.originalProfile.allowInsecureTls ||
		dialogState.profileIntervalSeconds !==
			dialogState.originalProfile.intervalSeconds ||
		dialogState.profileNumberOfCycles !==
			dialogState.originalProfile.numberOfCycles,
);

let showToken = $state(false);

let pingStatus = $state<PingStatus>("idle");
let pingError = $state("");
let pingResetTimer: ReturnType<typeof setTimeout> | undefined;

// Reset the ping result whenever the URL or version changes so stale indicators don't persist.
$effect(() => {
	const _host = dialogState.profileUrlHost;
	const _scheme = dialogState.profileScheme;
	const _version = dialogState.profileHttpVersion;
	const _insecure = dialogState.profileAllowInsecureTls;
	pingStatus = "idle";
	pingError = "";
});

async function testConnection() {
	const url = assembleUrl();
	const host = dialogState.profileUrlHost.trim();
	if (!host) {
		return;
	}

	try {
		new URL(url);
	} catch {
		pingStatus = "error";
		pingError = "Invalid URL format";
		return;
	}

	const token = dialogState.profileToken.trim();

	clearTimeout(pingResetTimer);
	pingStatus = "pending";
	pingError = "";

	try {
		await Ipc.agentPing(
			url,
			token || null,
			dialogState.profileHttpVersion,
			dialogState.profileAllowInsecureTls,
		);
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

					<ScrollArea.Root class="min-h-0 flex-1 mr-1">
						<div class="px-6 py-6">
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
											<span
												class="mb-3 block text-sm font-medium text-foreground"
												>Profile name</span
											>
											<Input
												bind:value={dialogState.profileName}
												placeholder="Production pprof"
											/>
										</label>

										<UrlField
											scheme={dialogState.profileScheme}
											host={dialogState.profileUrlHost}
											httpVersion={dialogState.profileHttpVersion}
											onSchemeChange={(v) => (dialogState.profileScheme = v)}
											onHostChange={(v) => (dialogState.profileUrlHost = v)}
											onHttpVersionChange={(v) =>
												(dialogState.profileHttpVersion = v)}
										/>

										<div class="block">
											<span
												class="mb-3 block text-sm font-medium text-foreground"
												>Auth token
												<span class="ml-1 font-normal text-muted-foreground"
													>(optional)</span
												></span
											>
											<div class="flex gap-2">
												<Input
													bind:value={dialogState.profileToken}
													placeholder="eyJ..."
													type={showToken
                                                        ? "text"
                                                        : "password"}
													class="flex-1"
												/>
												<Button
													variant="outline"
													size="icon"
													onclick={() =>
                                                        (showToken =
                                                            !showToken)}
													aria-label={showToken
                                                        ? "Hide token"
                                                        : "Show token"}
												>
													{#if showToken}
														<EyeOffIcon class="size-4" />
													{:else}
														<EyeIcon class="size-4" />
													{/if}
												</Button>
											</div>
										</div>

										{#if dialogState.profileScheme === "https"}
											<label
												class="flex w-full cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4 text-left transition-colors hover:border-primary/30"
											>
												<input
													type="checkbox"
													class="peer sr-only"
													bind:checked={dialogState.profileAllowInsecureTls}
												>
												<div
													class={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${dialogState.profileAllowInsecureTls ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
												>
													{#if dialogState.profileAllowInsecureTls}
														<CheckIcon class="size-3.5" />
													{/if}
												</div>
												<div>
													<span
														class="block text-sm font-medium text-foreground"
													>
														Allow invalid certificates
													</span>
													<span
														class="mt-1 block text-sm text-muted-foreground"
													>
														Connect even if the agent's TLS certificate cannot
														be verified. For a development agent with a
														self-signed certificate — the auth token is sent to
														whatever answers, so leave this off for anything
														reachable over a network.
													</span>
												</div>
											</label>
										{/if}

										<ModePicker
											value={dialogState.profileMode}
											onChange={(v) => (dialogState.profileMode = v)}
										/>

										{#if dialogState.profileMode === CollectionType.Stream}
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
												<p class="text-sm text-destructive">
													{pingError}
												</p>
											{/if}
											<div
												class="flex flex-wrap items-center justify-between gap-3"
											>
												<div class="flex flex-wrap gap-2">
													<Button
														variant="default"
														onclick={saveProfile}
														disabled={!hasChanges}
													>
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
														disabled={pingStatus ===
                                                            "pending" ||
                                                            !dialogState.profileUrlHost.trim()}
														class={pingStatus ===
                                                        "success"
                                                            ? "border-green-500/40 bg-green-500/10 text-green-600 hover:bg-green-500/15 hover:text-green-600"
                                                            : pingStatus ===
                                                                "error"
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
					</ScrollArea.Root>
				</div>
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>

<PMProjectDialog />
<PMDeleteDialog />
