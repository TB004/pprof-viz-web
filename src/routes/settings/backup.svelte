<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { UploadIcon } from "@lucide/svelte";
import { profileService, transferService } from "#lib/app.svelte.js";
import { Button } from "#lib/components/ui/button/index.js";
import ExportDialog from "#lib/transfer/export-dialog.svelte";
import Import from "#lib/transfer/import.svelte";
import { filenameStamp } from "#lib/utils";
import Section from "./section.svelte";
import SettingRow from "./setting-row.svelte";

const catalog = profileService.getCatalog();
const transferState = transferService.getState();

let exportOpen = $state(false);

const profileCount = $derived(
	catalog.projects.reduce(
		(total, project) => total + project.profiles.length,
		0,
	),
);
</script>

<Section
	id="backup"
	title="Backup"
	description="Move everything in this browser to a .ppvzb bundle, or bring one back."
>
	<SettingRow
		title="Export all data"
		description="Every project, profile and saved collection in one file. Settings are not included."
	>
		<Button
			variant="outline"
			disabled={transferState.busy}
			onclick={() => (exportOpen = true)}
		>
			<UploadIcon />
			Export…
		</Button>
	</SettingRow>
	<SettingRow
		title="Import"
		description="A bundle, a single .ppvz collection, or a zip of them."
	>
		<Import />
	</SettingRow>
</Section>

<ExportDialog
	bind:open={exportOpen}
	title="Export all data"
	subtitle="Everything stored in this browser, as one bundle."
	exportScope={{ all: true }}
	suggestedName={`pprof-viz-backup-${filenameStamp()}`}
	{profileCount}
/>
