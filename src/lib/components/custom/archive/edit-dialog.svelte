<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { Button } from "$lib/components/ui/button";
import * as Dialog from "$lib/components/ui/dialog";
import { Input } from "$lib/components/ui/input";
import { ArchiveService } from "$lib/services";
import type { CollectionRow } from "$lib/types";

let { target = $bindable(null) }: { target: CollectionRow | null } = $props();

let editName = $state("");
let editDescription = $state("");
let saving = $state(false);

// Seed the form whenever a new collection is opened for editing.
$effect(() => {
	if (target) {
		editName = target.name;
		editDescription = target.description ?? "";
	}
});

async function confirmEdit() {
	if (!target || !editName.trim() || saving) return;
	saving = true;
	const ok = await ArchiveService.update(
		target.id,
		editName,
		editDescription.trim() || null,
	);
	saving = false;
	if (ok) target = null;
}
</script>

<Dialog.Root
	open={target !== null}
	onOpenChange={(open) => {
		if (!open) target = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Edit collection</Dialog.Title>
			<Dialog.Description>
				Update the name and description of this saved collection.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-3 px-6">
			<div class="flex flex-col gap-1.5">
				<label for="edit-name" class="text-sm font-medium">Name</label>
				<Input
					id="edit-name"
					bind:value={editName}
					onkeydown={(e) => e.key === "Enter" && confirmEdit()}
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<label for="edit-description" class="text-sm font-medium">
					Description <span class="text-muted-foreground">(optional)</span>
				</label>
				<Input id="edit-description" bind:value={editDescription} />
			</div>
		</div>

		<div class="flex flex-wrap justify-end gap-2 px-6">
			<Button variant="outline" onclick={() => (target = null)}>Cancel</Button>
			<Button onclick={confirmEdit} disabled={!editName.trim() || saving}>
				{saving ? "Saving…" : "Save"}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
