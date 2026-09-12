<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { NameDescriptionDialog } from "$lib/components/custom/name-description-dialog";
import { archiveService } from "$lib/services";
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
	const ok = await archiveService.update(
		target.id,
		editName,
		editDescription.trim() || null,
	);
	saving = false;
	if (ok) target = null;
}
</script>

<NameDescriptionDialog
	bind:open={
		() => target !== null,
		(open) => {
			if (!open) target = null;
		}
	}
	title="Edit collection"
	subtitle="Update the name and description of this saved collection."
	bind:name={editName}
	bind:description={editDescription}
	pending={saving}
	onConfirm={confirmEdit}
/>
