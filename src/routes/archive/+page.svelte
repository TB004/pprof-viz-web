<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	ArchiveIcon,
	DownloadIcon,
	HardDriveIcon,
	UploadIcon,
} from "@lucide/svelte";
import { onMount } from "svelte";
import {
	ChartCard,
	CollectionTable,
	DeleteDialog,
	EditDialog,
	type Slice,
} from "#lib/components/custom/archive";
import { EmptyState, PageShell } from "#lib/components/custom/page";
import { ImportDialog } from "#lib/components/custom/transfer";
import { Button } from "#lib/components/ui/button";
import * as Card from "#lib/components/ui/card";
import { archiveService, transferService } from "#lib/services";
import type { CollectionRow } from "#lib/types";
import { FormatUtils } from "#lib/utils";

const archiveState = archiveService.getState();
const transferState = transferService.getState();

onMount(() => {
	void archiveService.refresh();
});

const collections = $derived(archiveState.collections);
const disk = $derived(archiveState.diskUsage);
const hasCollections = $derived(collections.length > 0);

// Cycle through the theme chart colors for slices.
const CHART_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

function withColors(
	items: { id: string; label: string; value: number }[],
): Slice[] {
	return items
		.filter((i) => i.value > 0)
		.map((i, idx) => ({
			...i,
			color: CHART_COLORS[idx % CHART_COLORS.length],
		}));
}

// How the browser's storage quota for this origin is spent, with our
// collections broken out from whatever else the app keeps (settings, the
// database, the cached app shell).
const diskSlices = $derived<Slice[]>(
	disk
		? withColors([
				{
					id: "collections",
					label: "Collections",
					value: disk.collectionsBytes,
				},
				{
					id: "other",
					label: "Other used",
					value: Math.max(
						0,
						disk.totalBytes - disk.freeBytes - disk.collectionsBytes,
					),
				},
				{
					id: "free",
					label: "Available",
					value: Math.max(0, disk.freeBytes),
				},
			])
		: [],
);

const perCollectionSlices = $derived<Slice[]>(
	withColors(
		collections.map((c) => ({ id: c.id, label: c.name, value: c.sizeBytes })),
	),
);

const perProfileSlices = $derived<Slice[]>(
	withColors(
		Object.entries(
			collections.reduce<Record<string, number>>((acc, c) => {
				const key = c.profileName || c.profileUrl || "Unknown";
				acc[key] = (acc[key] ?? 0) + c.sizeBytes;
				return acc;
			}, {}),
		).map(([label, value]) => ({ id: label, label, value })),
	),
);

let deleteTarget = $state<CollectionRow | null>(null);
let editTarget = $state<CollectionRow | null>(null);
let selectedIds = $state<string[]>([]);

// A selection only means anything for rows that are still listed.
$effect(() => {
	const present = new Set(collections.map((row) => row.id));
	const kept = selectedIds.filter((id) => present.has(id));
	if (kept.length !== selectedIds.length) selectedIds = kept;
});

async function exportSelected() {
	const ok = await transferService.exportArchives(selectedIds);
	if (ok) selectedIds = [];
}
</script>

<PageShell
	title="Archive"
	description="Saved collections stored in this browser as .ppvz files"
>
	{#snippet actions()}
		<div class="flex flex-wrap items-center justify-end gap-2">
			{#if selectedIds.length > 0}
				<Button
					variant="outline"
					size="sm"
					disabled={transferState.busy}
					onclick={exportSelected}
				>
					<UploadIcon />
					Export {selectedIds.length} selected
				</Button>
			{/if}
			<Button
				variant="outline"
				size="sm"
				disabled={transferState.busy}
				onclick={() => transferService.stageImport()}
			>
				<DownloadIcon />
				Import
			</Button>
			<div
				class="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-sm shadow-sm"
			>
				<HardDriveIcon class="size-4 text-muted-foreground" />
				<span class="font-medium tabular-nums">
					{FormatUtils.fmtBytes(disk?.collectionsBytes ?? 0)}
				</span>
				<span class="text-muted-foreground"
					>used by
					{collections.length}
					collection{collections.length === 1 ? "" : "s"}</span
				>
			</div>
		</div>
	{/snippet}

	<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
		<ChartCard
			title="Storage quota"
			description="Collections vs other app data vs available quota"
			slices={diskSlices}
			donut
		/>
		<ChartCard
			title="By collection"
			description="Storage footprint of each saved collection"
			slices={perCollectionSlices}
		/>
		<ChartCard
			title="By source"
			description="Footprint grouped by originating profile"
			slices={perProfileSlices}
		/>
	</div>

	{#if hasCollections}
		<Card.Root class="py-0">
			<Card.Content class="p-0">
				<CollectionTable
					{collections}
					bind:selectedIds
					onEdit={(row) => (editTarget = row)}
					onDelete={(row) => (deleteTarget = row)}
					onExport={(row) => transferService.exportArchives([row.id])}
				/>
			</Card.Content>
		</Card.Root>
	{:else}
		<EmptyState icon={ArchiveIcon} title="No saved collections">
			Collect some metrics, then use
			<span class="font-medium">Save</span>
			in the status bar to store them here.
		</EmptyState>
	{/if}
</PageShell>

<DeleteDialog bind:target={deleteTarget} />
<EditDialog bind:target={editTarget} />
<ImportDialog />
