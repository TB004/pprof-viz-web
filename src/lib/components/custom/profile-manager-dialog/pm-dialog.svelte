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
import {
	PMDeleteDialog,
	PMProjectDialog,
	PMSidebar,
} from "$lib/components/custom/profile-manager-dialog";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import Input from "$lib/components/ui/input/input.svelte";
import * as ScrollArea from "$lib/components/ui/scroll-area/index.js";
import * as Select from "$lib/components/ui/select/index.js";
import Ipc from "$lib/ipc";
import { ProfileService } from "$lib/services";
import { CollectionType, HttpVersion } from "$lib/types";
import { assembleUrl, clearProfileForm, dialogState } from "./state.svelte.ts";

type Props = {
	open?: boolean;
};

let { open = $bindable(false) }: Props = $props();

const modeOptions: Array<{
	value: CollectionType;
	title: string;
	description: string;
}> = [
	{
		value: CollectionType.Snapshot,
		title: "Snapshot",
		description: "Capture a focused point-in-time profile.",
	},
	{
		value: CollectionType.Stream,
		title: "Stream",
		description: "Continuously follow runtime changes.",
	},
];

const schemeOptions = [
	{ value: "http", label: "http://" },
	{ value: "https", label: "https://" },
] as const;

const httpVersionOptions: Array<{
	value: HttpVersion;
	label: string;
	requiresHttps: boolean;
}> = [
	{ value: HttpVersion.Http2, label: "HTTP/2", requiresHttps: false },
	{ value: HttpVersion.Http3, label: "HTTP/3", requiresHttps: true },
];

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

										<div class="block">
											<span
												class="mb-3 block text-sm font-medium text-foreground"
												>URL</span
											>
											<div class="flex gap-2">
												<Select.Root
													type="single"
													value={dialogState.profileScheme}
													onValueChange={(v) => {
                                                        if (v)
                                                            dialogState.profileScheme =
                                                                v as
                                                                    | "http"
                                                                    | "https";
                                                    }}
												>
													<Select.Trigger class="w-25 shrink-0">
														{schemeOptions.find(
                                                            (o) =>
                                                                o.value ===
                                                                dialogState.profileScheme,
                                                        )?.label ?? "http://"}
													</Select.Trigger>
													<Select.Content class="p-1.5">
														{#each schemeOptions as opt (opt.value)}
															<Select.Item
																value={opt.value}
																disabled={dialogState.profileHttpVersion ===
                                                                    HttpVersion.Http3 &&
                                                                    opt.value ===
                                                                        "http"}
															>
																{opt.label}
															</Select.Item>
														{/each}
													</Select.Content>
												</Select.Root>
												<Input
													bind:value={dialogState.profileUrlHost}
													placeholder="localhost:9090"
													class="flex-1 min-w-0"
												/>
												<Select.Root
													type="single"
													value={dialogState.profileHttpVersion}
													onValueChange={(v) => {
                                                        if (v)
                                                            dialogState.profileHttpVersion =
                                                                v as HttpVersion;
                                                    }}
												>
													<Select.Trigger class="w-25 shrink-0">
														{httpVersionOptions.find(
                                                            (o) =>
                                                                o.value ===
                                                                dialogState.profileHttpVersion,
                                                        )?.label ?? "HTTP/2"}
													</Select.Trigger>
													<Select.Content class="p-1.5">
														{#each httpVersionOptions as opt (opt.value)}
															<Select.Item value={opt.value}>
																{opt.label}
																{#if opt.requiresHttps}
																	<span
																		class="ml-1 text-xs text-muted-foreground"
																		>(https)</span
																	>
																{/if}
															</Select.Item>
														{/each}
													</Select.Content>
												</Select.Root>
											</div>
										</div>

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

										<div>
											<p class="mb-3 text-sm font-medium text-foreground">
												Mode
											</p>
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
