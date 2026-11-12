<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { TrashIcon } from "@lucide/svelte";
import { settingsService } from "#lib/app.svelte.js";
import ConfirmDialog from "#lib/components/confirm-dialog.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { Task } from "#lib/task.svelte.js";
import Section from "./section.svelte";
import SettingRow from "./setting-row.svelte";

let dialogOpen = $state(false);
// Reloads the page on success, so only a failure is ever seen here.
const resetting = new Task();

function openDialog() {
	resetting.reset();
	dialogOpen = true;
}
</script>

<Section
	id="danger"
	danger
	title="Danger zone"
	description="These actions cannot be undone."
>
	<SettingRow
		title="Delete all data"
		description="Removes every project, profile and saved collection, and resets settings to their defaults."
	>
		<Button variant="destructive" onclick={openDialog}>
			<TrashIcon />
			Delete all data…
		</Button>
	</SettingRow>
</Section>

<ConfirmDialog
	bind:open={dialogOpen}
	title="Delete all data?"
	description="This permanently deletes all projects, profiles and saved collections in this browser and resets every setting. This cannot be undone."
	confirmLabel="Delete all data"
	pending={resetting.pending}
	pendingLabel="Deleting…"
	error={resetting.error}
	onConfirm={() => resetting.run(() => settingsService.resetAllData())}
/>
