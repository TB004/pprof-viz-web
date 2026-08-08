<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	CircleAlertIcon,
	LoaderCircle,
	PauseIcon,
	SaveIcon,
} from "@lucide/svelte";
import {
	ErrorView,
	SaveDialog,
	StatusElement,
} from "$lib/components/custom/session-status-bar";
import { CollectionService, ErrorService } from "$lib/services";
import { CollectionStatus, CollectionType } from "$lib/types";
import { cn } from "$lib/utils.js";

let showErrors = $state(false);
let saveOpen = $state(false);

const collectionState = CollectionService.collectionState;
const errorState = ErrorService.errorState;

// Only offer to save freshly collected data — not a session loaded from disk,
// and only once it has stopped (Idle) with samples in hand.
const canSave = $derived(
	$collectionState.status === CollectionStatus.Idle &&
		$collectionState.collectedSamples > 0 &&
		!$collectionState.loaded &&
		!$collectionState.saved,
);

const modeLabel = $derived(
	$collectionState.mode === CollectionType.Snapshot
		? "Snapshot"
		: $collectionState.mode === CollectionType.Stream
			? "Stream"
			: undefined,
);

const urlLabel = $derived($collectionState.url?.toString() ?? undefined);

const statusLabel = $derived(
	$collectionState.status === CollectionStatus.Running ? "Running" : "Idle",
);

const statusIconClass = $derived(
	$collectionState.status === CollectionStatus.Running
		? "size-3.5 animate-spin text-foreground"
		: "size-3.5 text-muted-foreground",
);

const errorCount = $derived($errorState.length);
</script>

<footer
	class="border-sidebar-border/70 bg-sidebar/90 text-sidebar-foreground supports-backdrop-filter:bg-sidebar/80 shrink-0 border-t backdrop-blur"
>
	<div
		class="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-xs"
	>
		<StatusElement>
			{#if $collectionState.status === CollectionStatus.Running}
				<LoaderCircle class={statusIconClass} />
			{:else}
				<PauseIcon class={statusIconClass} />
			{/if}
			<span class="font-medium">{statusLabel}</span>
		</StatusElement>

		<StatusElement>
			<span class="text-muted-foreground">URL</span>
			{#if urlLabel}
				<span class="truncate font-medium">{urlLabel}</span>
			{:else}
				<span class="font-medium text-muted-foreground">undefined</span>
			{/if}
		</StatusElement>

		<StatusElement>
			<span class="text-muted-foreground">Mode</span>
			{#if modeLabel}
				<span class="font-medium">{modeLabel}</span>
			{:else}
				<span class="font-medium text-muted-foreground">undefined</span>
			{/if}
		</StatusElement>

		<StatusElement>
			<span class="text-muted-foreground">Samples</span>
			<span class="font-medium">{$collectionState.collectedSamples}</span>
		</StatusElement>

		<StatusElement>
			<span class="text-muted-foreground">Time</span>
			<span class="font-medium"
				>{CollectionService.formatElapsedTime(
                    $collectionState.elapsedSeconds,
                )}</span
			>
		</StatusElement>

		<button
			type="button"
			disabled={!canSave}
			onclick={() => (saveOpen = true)}
			class="ml-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<SaveIcon class="size-3.5" />
			<span>Save</span>
		</button>

		<button
			type="button"
			onclick={() => (showErrors = !showErrors)}
			class={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition-all",
                errorCount > 0
                    ? "border-red-500/20 bg-red-500/10 text-red-600 hover:bg-red-500/15"
                    : "border-border/60 bg-background/70 text-muted-foreground hover:bg-muted/80",
            )}
		>
			<span>Error</span>
			<span class="tabular-nums">{errorCount}</span>
			<CircleAlertIcon
				class={cn(
                    "size-3.5",
                    errorCount > 0 ? "text-red-500" : "text-muted-foreground",
                )}
			/>
		</button>
	</div>
</footer>

{#if showErrors}
	<ErrorView bind:showErrors />
{/if}

<SaveDialog bind:open={saveOpen} />
