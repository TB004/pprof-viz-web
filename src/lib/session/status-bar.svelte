<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { CheckIcon, TriangleAlertIcon, XIcon } from "@lucide/svelte";
import { fly } from "svelte/transition";
import {
	collectionService,
	profileService,
	serviceWorkerService,
} from "#lib/app.svelte.js";
import { Button } from "#lib/components/ui/button/index.js";
import { openProfileManager } from "#lib/profiles/state.svelte.js";
import { fmtClock, fmtCount } from "#lib/utils";
import { modeLabel, sessionStatus } from "./status.js";
import StatusDot from "./status-dot.svelte";

const collectionState = collectionService.getState();
const swState = serviceWorkerService.getState();

let showError = $state(false);

// A new failure is worth looking at; it opens itself once.
$effect(() => {
	showError = collectionState.error !== null;
});

const status = $derived(sessionStatus(collectionState));

const mode = $derived(
	modeLabel(
		collectionState.selectedProfile && !collectionState.loaded
			? profileService.find(collectionState.selectedProfile)
			: undefined,
		collectionState.mode,
	),
);

function dismissError() {
	showError = false;
	collectionService.clearError();
}

function editProfile() {
	showError = false;
	openProfileManager(collectionState.selectedProfile);
}
</script>

<footer
	class="border-line bg-surface text-ink-2 flex min-h-9 shrink-0 flex-wrap items-center gap-x-[18px] gap-y-1.5 border-t px-4 py-1.5 text-xs sm:px-6"
>
	<span class="inline-flex items-center gap-[7px] whitespace-nowrap">
		<StatusDot tone={status.tone} />
		<b class="font-semibold">{status.label}</b>
	</span>
	<span class="mono truncate max-sm:hidden">
		{collectionState.url?.toString() ?? "no collector"}
	</span>
	<span class="whitespace-nowrap max-md:hidden">{mode}</span>
	<span class="inline-flex items-center gap-[7px] whitespace-nowrap">
		<span class="text-muted-foreground">Samples</span>
		<span class="mono">{fmtCount(collectionState.collectedSamples)}</span>
	</span>
	<span class="inline-flex items-center gap-[7px] whitespace-nowrap">
		<span class="text-muted-foreground">Elapsed</span>
		<span class="mono">{fmtClock(collectionState.elapsedSeconds)}</span>
	</span>
	<span class="flex-1"></span>
	{#if collectionState.error}
		<button
			type="button"
			class="bg-bad-soft text-bad inline-flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold"
			onclick={() => (showError = !showError)}
		>
			<TriangleAlertIcon class="size-3.5" />
			Collection failed
		</button>
	{/if}
	{#if swState.ready}
		<span
			class="text-muted-foreground inline-flex items-center gap-[7px] whitespace-nowrap"
		>
			<CheckIcon class="size-3.5" />
			Available offline
		</span>
	{/if}
</footer>

{#if showError && collectionState.error}
	<div
		role="alert"
		class="border-line-2 bg-surface shadow-pop fixed right-5 bottom-14 z-50 w-[min(400px,calc(100vw-40px))] overflow-hidden rounded-panel border"
		transition:fly={{ y: 12, duration: 160 }}
	>
		<div class="border-line flex items-center gap-2.5 border-b px-4 py-3.5">
			<TriangleAlertIcon class="text-bad size-4" />
			<b class="text-sm">Collection failed</b>
			<Button
				variant="ghost"
				size="icon-sm"
				class="ml-auto"
				aria-label="Close"
				onclick={() => (showError = false)}
			>
				<XIcon />
			</Button>
		</div>
		<div class="flex flex-col gap-3 px-4 py-3.5">
			<p class="mono text-ink-2 text-xs leading-relaxed wrap-break-word">
				{collectionState.error}
			</p>
			<div class="flex justify-end gap-2">
				{#if collectionState.selectedProfile}
					<Button variant="outline" size="sm" onclick={editProfile}>
						Edit profile
					</Button>
				{/if}
				<Button size="sm" onclick={dismissError}>Dismiss</Button>
			</div>
		</div>
	</div>
{/if}
