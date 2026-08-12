<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { Button } from "$lib/components/ui/button";
import * as Dialog from "$lib/components/ui/dialog";
import { Input } from "$lib/components/ui/input";
import { ArchiveService, CollectionService } from "$lib/services";

let { open: dialogOpen = $bindable(false) }: { open: boolean } = $props();

let saveName = $state("");
let saveDescription = $state("");
let saving = $state(false);

const collectionState = CollectionService.collectionState;

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

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Save collection</Dialog.Title>
			<Dialog.Description>
				Store the current
				{collectionState.collectedSamples}
				sample{collectionState.collectedSamples === 1 ? "" : "s"}
				to disk as a .ppvz file.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-3 px-6">
			<div class="flex flex-col gap-1.5">
				<label for="collection-name" class="text-sm font-medium">Name</label>
				<Input
					id="collection-name"
					bind:value={saveName}
					placeholder="My collection"
					onkeydown={(e) => e.key === "Enter" && confirmSave()}
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<label for="collection-description" class="text-sm font-medium">
					Description <span class="text-muted-foreground">(optional)</span>
				</label>
				<Input
					id="collection-description"
					bind:value={saveDescription}
					placeholder="What this captures…"
				/>
			</div>
		</div>

		<div class="flex flex-wrap justify-end gap-2 px-6">
			<Button variant="outline" onclick={() => (dialogOpen = false)}
				>Cancel</Button
			>
			<Button onclick={confirmSave} disabled={!saveName.trim() || saving}>
				{saving ? "Saving…" : "Save"}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
