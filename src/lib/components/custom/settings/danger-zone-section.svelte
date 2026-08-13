<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { TriangleAlertIcon } from "@lucide/svelte";
import * as Card from "$lib/components/ui/card/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import Ipc from "$lib/ipc";

let dialogOpen = $state(false);
let resetting = $state(false);

async function resetAllData() {
	resetting = true;
	try {
		await Ipc.resetAllData();
		try {
			localStorage.removeItem("pprof-viz-settings");
		} catch {}
		window.location.reload();
	} finally {
		resetting = false;
	}
}
</script>

<Card.Root class="border-destructive/50">
	<Card.Header>
		<Card.Title class="text-base text-destructive">Danger Zone</Card.Title>
		<Card.Description
			>These actions are irreversible. Proceed with caution.</Card.Description
		>
	</Card.Header>
	<Card.Content>
		<div class="flex items-center justify-between gap-4">
			<div>
				<p class="text-sm font-medium text-foreground">Delete all data</p>
				<p class="mt-0.5 text-sm text-muted-foreground">
					Permanently removes all projects, profiles, and resets settings to
					defaults.
				</p>
			</div>
			<button
				type="button"
				class="shrink-0 inline-flex h-9 items-center gap-2 rounded-md border border-destructive/60 bg-destructive/10 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/40 hover:text-destructive-foreground"
				onclick={() => (dialogOpen = true)}
			>
				<TriangleAlertIcon class="size-4" />
				Delete all data
			</button>
		</div>
	</Card.Content>
</Card.Root>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content class="max-w-md">
			<Dialog.Header>
				<Dialog.Title>Delete all data?</Dialog.Title>
				<Dialog.Description class="mt-5">
					This will permanently delete all projects and profiles, and reset all
					settings to their defaults. This action cannot be undone.
				</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer class="mt-4 flex justify-end gap-3">
				<Dialog.Close
					class="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
				>
					Cancel
				</Dialog.Close>
				<button
					type="button"
					disabled={resetting}
					class="inline-flex h-9 items-center justify-center rounded-md bg-destructive/70 px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/80 disabled:opacity-50"
					onclick={resetAllData}
				>
					{resetting ? "Deleting…" : "Delete all data"}
				</button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
