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
	XIcon,
} from "@lucide/svelte";
import { fly } from "svelte/transition";
import { archiveService, collectionService } from "#lib/app.svelte.js";
import NameDescriptionDialog from "#lib/components/name-description-dialog.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Card from "#lib/components/ui/card/index.js";
import { Task } from "#lib/task.svelte.js";
import { CollectionStatus, CollectionType } from "#lib/types";
import { fmtElapsed } from "#lib/utils";

const collectionState = collectionService.getState();

let showError = $state(false);
let saveOpen = $state(false);
let saveName = $state("");
let saveDescription = $state("");
const saving = new Task();

// A new failure is worth looking at; it opens itself once.
$effect(() => {
	showError = collectionState.error !== null;
});

// Only offer to save freshly collected data — not a session loaded from disk,
// and only once it has stopped (Idle) with samples in hand.
const canSave = $derived(
	collectionState.status === CollectionStatus.Idle &&
		collectionState.collectedSamples > 0 &&
		!collectionState.loaded &&
		!collectionState.saved,
);

const isRunning = $derived(collectionState.status === CollectionStatus.Running);

const modeLabel = $derived(
	collectionState.mode === CollectionType.Snapshot
		? "Snapshot"
		: collectionState.mode === CollectionType.Stream
			? "Stream"
			: undefined,
);

const urlLabel = $derived(collectionState.url?.toString() ?? undefined);

const saveSubtitle = $derived(
	`Store the current ${collectionState.collectedSamples} sample${
		collectionState.collectedSamples === 1 ? "" : "s"
	} to disk as a .ppvz file.`,
);

function openSave() {
	saving.reset();
	saveOpen = true;
}

async function confirmSave() {
	if (!saveName.trim()) return;
	const ok = await saving.run(() =>
		archiveService.save(saveName, saveDescription.trim() || null),
	);
	if (ok) {
		saveOpen = false;
		saveName = "";
		saveDescription = "";
	}
}

function dismissError() {
	showError = false;
	collectionService.clearError();
}
</script>

{#snippet pill(
	label: string,
	value: string | undefined,
)}
	<div
		class="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 shadow-sm"
	>
		<span class="text-muted-foreground">{label}</span>
		<span
			class={value
				? "truncate font-medium"
				: "font-medium text-muted-foreground"}
		>
			{value ?? "undefined"}
		</span>
	</div>
{/snippet}

<footer
	class="border-sidebar-border/70 bg-sidebar/90 text-sidebar-foreground shrink-0 border-t"
>
	<div
		class="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-xs"
	>
		<div
			class="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 shadow-sm"
		>
			{#if isRunning}
				<LoaderCircle class="size-3.5 animate-spin text-foreground" />
			{:else}
				<PauseIcon class="size-3.5 text-muted-foreground" />
			{/if}
			<span class="font-medium">{isRunning ? "Running" : "Idle"}</span>
		</div>

		{@render pill("URL", urlLabel)}
		{@render pill("Mode", modeLabel)}
		{@render pill("Samples", String(collectionState.collectedSamples))}
		{@render pill("Time", fmtElapsed(collectionState.elapsedSeconds))}

		<button
			type="button"
			disabled={!canSave}
			onclick={openSave}
			class="ml-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<SaveIcon class="size-3.5" />
			<span>Save</span>
		</button>

		{#if collectionState.error}
			<button
				type="button"
				onclick={() => (showError = !showError)}
				class="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-all hover:bg-red-500/15"
			>
				<CircleAlertIcon class="size-3.5 text-red-500" />
				<span>Collection failed</span>
			</button>
		{/if}
	</div>
</footer>

{#if showError && collectionState.error}
	<div
		class="fixed right-4 bottom-20 z-50 w-[min(24rem,calc(100vw-2rem))]"
		transition:fly={{ y: 12, duration: 160 }}
	>
		<Card.Root
			class="gap-0 rounded-2xl border border-border/70 bg-popover/95 py-0 text-popover-foreground shadow-2xl ring-0 backdrop-blur-xl"
		>
			<Card.Header class="border-b border-border/60 px-4 py-3">
				<Card.Title class="flex items-center gap-2 text-sm font-semibold mt-2">
					<CircleAlertIcon class="size-4 text-red-500" />
					Collection failed
				</Card.Title>
				<Card.Action>
					<Button
						variant="ghost"
						class="bg-secondary"
						size="icon-sm"
						onclick={() => (showError = false)}
					>
						<XIcon class="size-3.5" />
						<span class="sr-only">Close</span>
					</Button>
				</Card.Action>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3 p-4">
				<p class="text-sm wrap-break-word">{collectionState.error}</p>
				<Button
					variant="outline"
					size="sm"
					class="self-end"
					onclick={dismissError}
				>
					Dismiss
				</Button>
			</Card.Content>
		</Card.Root>
	</div>
{/if}

<NameDescriptionDialog
	bind:open={saveOpen}
	title="Save collection"
	subtitle={saveSubtitle}
	bind:name={saveName}
	bind:description={saveDescription}
	namePlaceholder="My collection"
	descriptionPlaceholder="What this captures…"
	pending={saving.pending}
	error={saving.error}
	onConfirm={confirmSave}
/>
