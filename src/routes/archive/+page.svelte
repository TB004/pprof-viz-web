<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { ArchiveIcon, UploadIcon } from "@lucide/svelte";
import { onMount } from "svelte";
import { archiveService, transferService } from "#lib/app.svelte.js";
import ConfirmDialog from "#lib/components/confirm-dialog.svelte";
import EmptyState from "#lib/components/empty-state.svelte";
import ErrorAlert from "#lib/components/error-alert.svelte";
import NameDescriptionDialog from "#lib/components/name-description-dialog.svelte";
import PageShell from "#lib/components/page-shell.svelte";
import Panel from "#lib/components/panel.svelte";
import { Button } from "#lib/components/ui/button";
import { Task } from "#lib/task.svelte.js";
import Import from "#lib/transfer/import.svelte";
import type { CollectionRow } from "#lib/types";
import { fmtBytes } from "#lib/utils";
import { goto } from "$app/navigation";
import CollectionTable from "./collection-table.svelte";

const archiveState = archiveService.getState();
const transferState = transferService.getState();

onMount(() => {
	void archiveService.refresh();
});

const collections = $derived(archiveState.collections);
const hasCollections = $derived(collections.length > 0);

// How the browser's storage quota for this origin is spent, with our
// collections broken out from whatever else the app keeps (settings, the
// database, the cached app shell).
const storage = $derived.by(() => {
	const disk = archiveState.diskUsage;
	const quota = disk?.totalBytes ?? 0;
	const saved = disk?.collectionsBytes ?? 0;
	const used = disk ? Math.max(saved, quota - disk.freeBytes) : saved;
	const pct = (v: number) => (quota ? (v / quota) * 100 : 0);
	return {
		quota,
		saved,
		used,
		other: Math.max(0, used - saved),
		free: disk?.freeBytes ?? 0,
		usedPct: pct(used),
		savedPct: pct(saved),
		otherPct: pct(Math.max(0, used - saved)),
	};
});

const SOURCE_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

const bySource = $derived.by(() => {
	const totals = new Map<string, number>();
	for (const c of collections) {
		const key = c.profileName || c.profileUrl || "Unknown";
		totals.set(key, (totals.get(key) ?? 0) + c.sizeBytes);
	}
	const sorted = [...totals].sort((a, b) => b[1] - a[1]);
	const max = sorted[0]?.[1] ?? 1;
	return sorted.map(([label, bytes], i) => ({
		label,
		bytes,
		width: (bytes / max) * 100,
		color: SOURCE_COLORS[i % SOURCE_COLORS.length],
	}));
});

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
	description="Collections saved in this browser as compressed .ppvz files in the Origin Private File System."
>
	{#snippet actions()}
		<div class="flex flex-wrap items-center gap-2">
			{#if selectedIds.length > 0}
				<Button
					variant="outline"
					disabled={transferState.busy}
					onclick={exportSelected}
				>
					<UploadIcon />
					Export {selectedIds.length} selected
				</Button>
			{/if}
			<Import />
		</div>
	{/snippet}

	<ErrorAlert message={archiveState.error} />
	<ErrorAlert message={listing.error} onDismiss={() => listing.reset()} />

	<div class="panel-grid">
		<Panel title="Storage" description="This origin’s browser quota.">
			<div class="flex flex-col gap-3.5 px-[18px] pt-2 pb-[18px]">
				<div class="flex flex-wrap items-baseline gap-2.5">
					<span class="mono text-[30px] font-[550] tracking-[-0.02em]">
						{fmtBytes(storage.used)}
					</span>
					<span class="text-muted-foreground">
						{#if storage.quota}
							of {fmtBytes(storage.quota)} used · {storage.usedPct.toFixed(2)}%
						{:else}
							used — the browser reports no quota
						{/if}
					</span>
				</div>
				<div
					class="bg-grid flex h-2.5 overflow-hidden rounded-[5px]"
					aria-hidden="true"
				>
					<div
						class="bg-acc min-w-[3px]"
						style:width="{storage.savedPct}%"
					></div>
					<div
						class="bg-faint min-w-0.5"
						style:width="{storage.otherPct}%"
					></div>
				</div>
				<div class="flex flex-col">
					{#each [
						{
							label: "Saved collections",
							bytes: storage.saved,
							note: `${collections.length} file${collections.length === 1 ? "" : "s"}`,
							swatch: "bg-acc",
						},
						{
							label: "App shell, database, settings",
							bytes: storage.other,
							note: "",
							swatch: "bg-faint",
						},
						{
							label: "Available",
							bytes: storage.free,
							note: "",
							swatch: "bg-grid border border-line-2",
						},
					] as item (item.label)}
						<div
							class="border-line grid grid-cols-[12px_1fr_auto_64px] items-center gap-2.5 border-t py-2 text-[13px]"
						>
							<span class="size-[9px] rounded-[3px] {item.swatch}"></span>
							<span>{item.label}</span>
							<span class="mono text-right">{fmtBytes(item.bytes)}</span>
							<span class="mono text-muted-foreground text-right"
								>{item.note}</span
							>
						</div>
					{/each}
				</div>
			</div>
		</Panel>

		<Panel
			title="By source"
			description="Footprint grouped by the profile a collection was captured with."
		>
			<div class="flex flex-col gap-3 px-[18px] pt-3 pb-[18px]">
				{#each bySource as source (source.label)}
					<div
						class="grid grid-cols-[minmax(90px,140px)_1fr_72px] items-center gap-3 text-[13px]"
					>
						<span class="truncate">{source.label}</span>
						<div class="bg-grid h-2 overflow-hidden rounded-sm">
							<div
								class="h-full rounded-sm"
								style:width="{source.width}%"
								style:background={source.color}
							></div>
						</div>
						<span class="mono text-right">{fmtBytes(source.bytes)}</span>
					</div>
				{:else}
					<span class="text-muted-foreground text-[13px]">No data yet.</span>
				{/each}
			</div>
		</Panel>
	</div>

	{#if hasCollections}
		<Panel class="overflow-hidden">
			<CollectionTable
				{collections}
				bind:selectedIds
				{loadingId}
				onLoad={load}
				onEdit={openEdit}
				onDelete={openDelete}
				onExport={exportOne}
			/>
		</Panel>
	{:else}
		<EmptyState icon={ArchiveIcon} title="No saved collections">
			Collect some metrics, then use “Save collection” in the top bar to keep
			them here — or import a .ppvz / .ppvzb file.
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
	confirmLabel="Save changes"
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
	description={`Delete “${deleteTarget?.name}” and its .ppvz file. This cannot be undone.`}
	confirmLabel="Delete collection"
	pending={deleting.pending}
	pendingLabel="Deleting…"
	error={deleting.error}
	onConfirm={confirmDelete}
/>
