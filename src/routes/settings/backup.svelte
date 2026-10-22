<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { UploadIcon } from "@lucide/svelte";
import { profileService, transferService } from "#lib/app.svelte.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Card from "#lib/components/ui/card/index.js";
import ExportDialog from "#lib/transfer/export-dialog.svelte";
import Import from "#lib/transfer/import.svelte";
import { filenameStamp } from "#lib/utils";

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

<Card.Root class="border-border/60">
	<Card.Header>
		<Card.Title class="text-base">Backup</Card.Title>
		<Card.Description>
			Move everything in this browser to a <code class="text-xs">.ppvzb</code>
			bundle, or bring one back.
		</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		<div class="flex items-center justify-between gap-4">
			<div>
				<p class="text-sm font-medium text-foreground">Export all data</p>
				<p class="mt-0.5 text-sm text-muted-foreground">
					Every project, profile and saved collection in one file. Settings are
					not included.
				</p>
			</div>
			<Button
				variant="outline"
				class="shrink-0"
				disabled={transferState.busy}
				onclick={() => (exportOpen = true)}
			>
				<UploadIcon />
				Export
			</Button>
		</div>

		<div class="flex items-center justify-between gap-4">
			<div>
				<p class="text-sm font-medium text-foreground">Import</p>
				<p class="mt-0.5 text-sm text-muted-foreground">
					Read a bundle, a single
					<code class="text-xs">.ppvz</code>
					collection, or a zip of them.
				</p>
			</div>
			<Import class="shrink-0" />
		</div>
	</Card.Content>
</Card.Root>

<ExportDialog
	bind:open={exportOpen}
	title="Export all data"
	subtitle="Everything stored in this browser, as one bundle."
	exportScope={{ all: true }}
	suggestedName={`pprof-viz-backup-${filenameStamp()}`}
	{profileCount}
/>
