<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { NameDescriptionDialog } from "$lib/components/custom/name-description-dialog";
import { ArchiveService, CollectionService } from "$lib/services";

let { open: dialogOpen = $bindable(false) }: { open: boolean } = $props();

let saveName = $state("");
let saveDescription = $state("");
let saving = $state(false);

const collectionState = CollectionService.collectionState;

const subtitle = $derived(
	`Store the current ${collectionState.collectedSamples} sample${
		collectionState.collectedSamples === 1 ? "" : "s"
	} to disk as a .ppvz file.`,
);

async function confirmSave() {
	if (!saveName.trim() || saving) return;
	saving = true;
	const ok = await ArchiveService.save(
		saveName,
		saveDescription.trim() || null,
	);
	saving = false;
	if (ok) {
		dialogOpen = false;
		saveName = "";
		saveDescription = "";
	}
}
</script>

<NameDescriptionDialog
	bind:open={dialogOpen}
	title="Save collection"
	{subtitle}
	bind:name={saveName}
	bind:description={saveDescription}
	namePlaceholder="My collection"
	descriptionPlaceholder="What this captures…"
	pending={saving}
	onConfirm={confirmSave}
/>
