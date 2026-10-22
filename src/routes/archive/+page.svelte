<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { ArchiveIcon, HardDriveIcon, UploadIcon } from "@lucide/svelte";
import { onMount } from "svelte";
import { archiveService, transferService } from "#lib/app.svelte.js";
import ConfirmDialog from "#lib/components/confirm-dialog.svelte";
import EmptyState from "#lib/components/empty-state.svelte";
import ErrorAlert from "#lib/components/error-alert.svelte";
import NameDescriptionDialog from "#lib/components/name-description-dialog.svelte";
import PageShell from "#lib/components/page-shell.svelte";
import { Button } from "#lib/components/ui/button";
import * as Card from "#lib/components/ui/card";
import { Task } from "#lib/task.svelte.js";
import Import from "#lib/transfer/import.svelte";
import type { CollectionRow } from "#lib/types";
import { fmtBytes } from "#lib/utils";
import { goto } from "$app/navigation";
import ChartCard, { type Slice } from "./chart-card.svelte";
import CollectionTable from "./collection-table.svelte";

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

let selectedIds = $state<string[]>([]);
let loadingId = $state<string | null>(null);

/** Loading or exporting straight from the listing; reported above it. */
const listing = new Task();
const editing = new Task();
const deleting = new Task();

let editTarget = $state<CollectionRow | null>(null);
let editName = $state("");
let editDescription = $state("");
let deleteTarget = $state<CollectionRow | null>(null);

// A selection only means anything for rows that are still listed.
$effect(() => {
	const present = new Set(collections.map((row) => row.id));
	const kept = selectedIds.filter((id) => present.has(id));
	if (kept.length !== selectedIds.length) selectedIds = kept;
});

async function load(row: CollectionRow) {
	loadingId = row.id;
	const ok = await listing.run(() => archiveService.load(row.id));
	loadingId = null;
	if (ok) await goto("/cpu");
}

function exportOne(row: CollectionRow) {
	void listing.run(() => transferService.exportArchives([row.id]));
}

async function exportSelected() {
	const ok = await listing.run(() =>
		transferService.exportArchives(selectedIds),
	);
	if (ok) selectedIds = [];
}

function openEdit(row: CollectionRow) {
	editing.reset();
	editName = row.name;
	editDescription = row.description ?? "";
	editTarget = row;
}

async function confirmEdit() {
	const target = editTarget;
	if (!target || !editName.trim()) return;
	const ok = await editing.run(() =>
		archiveService.update(target.id, editName, editDescription.trim() || null),
	);
	if (ok) editTarget = null;
}

function openDelete(row: CollectionRow) {
	deleting.reset();
	deleteTarget = row;
}

async function confirmDelete() {
	const target = deleteTarget;
	if (!target) return;
	const ok = await deleting.run(() => archiveService.remove(target.id));
	if (ok) deleteTarget = null;
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
			<Import size="sm" />
			<div
				class="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-sm shadow-sm"
			>
				<HardDriveIcon class="size-4 text-muted-foreground" />
				<span class="font-medium tabular-nums">
					{fmtBytes(disk?.collectionsBytes ?? 0)}
				</span>
				<span class="text-muted-foreground"
					>used by
					{collections.length}
					collection{collections.length === 1 ? "" : "s"}</span
				>
			</div>
		</div>
	{/snippet}

	<ErrorAlert message={archiveState.error} />
	<ErrorAlert message={listing.error} onDismiss={() => listing.reset()} />

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
					{loadingId}
					onLoad={load}
					onEdit={openEdit}
					onDelete={openDelete}
					onExport={exportOne}
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

<NameDescriptionDialog
	bind:open={
		() => editTarget !== null,
		(open) => {
	if (!open) editTarget = null;
}
	}
	title="Edit collection"
	subtitle="Update the name and description of this saved collection."
	bind:name={editName}
	bind:description={editDescription}
	pending={editing.pending}
	error={editing.error}
	onConfirm={confirmEdit}
/>

<ConfirmDialog
	bind:open={
		() => deleteTarget !== null,
		(open) => {
	if (!open) deleteTarget = null;
}
	}
	title="Delete collection"
	description={`Delete ${deleteTarget?.name} and its .ppvz file. This cannot be undone.`}
	pending={deleting.pending}
	pendingLabel="Deleting…"
	error={deleting.error}
	onConfirm={confirmDelete}
/>
