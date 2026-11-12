<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { SaveIcon } from "@lucide/svelte";
import { archiveService, collectionService } from "#lib/app.svelte.js";
import NameDescriptionDialog from "#lib/components/name-description-dialog.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { Task } from "#lib/task.svelte.js";
import { CollectionStatus } from "#lib/types";
import { fmtClock, fmtCount, fmtTimeOfDay } from "#lib/utils";

// The top bar's "Save collection" button and the dialog it opens.

const collectionState = collectionService.getState();

let open = $state(false);
let name = $state("");
let description = $state("");
const saving = new Task();

// Only offer to save freshly collected data — not a session loaded from disk,
// and only once it has stopped (Idle) with samples in hand.
const canSave = $derived(
	collectionState.status === CollectionStatus.Idle &&
		collectionState.collectedSamples > 0 &&
		!collectionState.loaded &&
		!collectionState.saved,
);

function openDialog() {
	saving.reset();
	const started = collectionState.startedAt;
	name = [
		collectionState.selectedProfileLabel ?? "Collection",
		started ? fmtTimeOfDay(started) : undefined,
	]
		.filter(Boolean)
		.join(" · ");
	description = "";
	open = true;
}

async function confirm() {
	if (!name.trim()) return;
	const ok = await saving.run(() =>
		archiveService.save(name, description.trim() || null),
	);
	if (ok) open = false;
}
</script>

<Button variant="outline" disabled={!canSave} onclick={openDialog}>
	<SaveIcon />
	<span class="max-sm:sr-only">Save collection</span>
</Button>

{#snippet summary()}
	<div class="grid grid-cols-3 gap-2">
		{#each [
			["Samples", fmtCount(collectionState.collectedSamples)],
			["Duration", fmtClock(collectionState.elapsedSeconds)],
			["Profile", collectionState.selectedProfileLabel ?? "—"],
		] as tile (tile[0])}
			<div
				class="border-line bg-surface-2 min-w-0 rounded-[10px] border px-3 py-2.5"
			>
				<div class="text-muted-foreground text-[11.5px]">{tile[0]}</div>
				<div class="mono truncate text-base font-[550]">{tile[1]}</div>
			</div>
		{/each}
	</div>
{/snippet}

<NameDescriptionDialog
	bind:open
	title="Save collection"
	subtitle="Stored in this browser as a compressed .ppvz file."
	bind:name
	bind:description
	namePlaceholder="My collection"
	descriptionPlaceholder="What this captures…"
	confirmLabel="Save to archive"
	pending={saving.pending}
	error={saving.error}
	onConfirm={confirm}
	{summary}
/>
