<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { ConfirmDialog } from "$lib/components/custom/confirm-dialog";
import { ArchiveService } from "$lib/services";
import type { CollectionRow } from "$lib/types";

let { target = $bindable(null) }: { target: CollectionRow | null } = $props();

async function confirmDelete() {
	if (!target) return;
	await ArchiveService.remove(target.id);
	target = null;
}
</script>

<ConfirmDialog
	bind:open={() => target !== null, (open) => {
			if (!open) target = null;
		}}
	title="Delete collection"
	description={`Delete ${target?.name} and its .ppvz file. This cannot be undone.`}
	onConfirm={confirmDelete}
/>
