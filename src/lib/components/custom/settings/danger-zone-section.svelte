<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { TriangleAlertIcon } from "@lucide/svelte";
import { ConfirmDialog } from "#lib/components/custom/confirm-dialog";
import * as Card from "#lib/components/ui/card/index.js";
import { settingsService } from "#lib/services";

let dialogOpen = $state(false);
let resetting = $state(false);

async function resetAllData() {
	resetting = true;
	try {
		// Reloads the page on success, so `resetting` is only reset on failure.
		await settingsService.resetAllData();
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
					Permanently removes all projects, profiles and saved collections, and
					resets settings to their defaults.
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

<ConfirmDialog
	bind:open={dialogOpen}
	title="Delete all data?"
	description="This will permanently delete all projects, profiles and saved collections stored in this browser, and reset all settings to their defaults. This action cannot be undone."
	confirmLabel="Delete all data"
	pending={resetting}
	pendingLabel="Deleting…"
	onConfirm={resetAllData}
/>
