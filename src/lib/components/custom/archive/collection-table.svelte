<script lang="ts">
import { DownloadIcon, PencilIcon, Trash2Icon } from "@lucide/svelte";
import { type ColumnDef, getCoreRowModel } from "@tanstack/table-core";
import { goto } from "$app/navigation";
import { Button } from "$lib/components/ui/button";
import {
	createSvelteTable,
	FlexRender,
	renderSnippet,
} from "$lib/components/ui/data-table";
import * as Table from "$lib/components/ui/table";
import { fmtBytes } from "$lib/format";
import { ArchiveService, CollectionService } from "$lib/services";
import type { CollectionRow } from "$lib/types";

let {
	collections,
	onEdit,
	onDelete,
}: {
	collections: CollectionRow[];
	onEdit: (row: CollectionRow) => void;
	onDelete: (row: CollectionRow) => void;
} = $props();

let loadingId = $state<string | null>(null);

async function load(row: CollectionRow) {
	loadingId = row.id;
	const ok = await ArchiveService.load(row.id);
	loadingId = null;
	if (ok) await goto("/cpu");
}

function fmtDuration(ms: number): string {
	return CollectionService.formatElapsedTime(
		Math.max(0, Math.floor(ms / 1000)),
	);
}

function fmtDate(ms: number): string {
	return new Date(ms).toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

const columns: ColumnDef<CollectionRow>[] = [
	{ accessorKey: "name", header: "Name" },
	{
		accessorKey: "description",
		header: "Description",
		cell: ({ row }) => renderSnippet(descCell, row.original),
	},
	{
		accessorKey: "sizeBytes",
		header: "Size",
		cell: ({ row }) => renderSnippet(sizeCell, row.original),
	},
	{
		accessorKey: "durationMs",
		header: "Duration",
		cell: ({ row }) => renderSnippet(durationCell, row.original),
	},
	{
		accessorKey: "sampleCount",
		header: "Samples",
		cell: ({ row }) => renderSnippet(samplesCell, row.original),
	},
	{
		accessorKey: "createdAt",
		header: "Date",
		cell: ({ row }) => renderSnippet(dateCell, row.original),
	},
	{
		id: "actions",
		header: "",
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	},
];

const table = createSvelteTable({
	get data() {
		return collections;
	},
	columns,
	getCoreRowModel: getCoreRowModel(),
});
</script>

{#snippet descCell(row: CollectionRow)}
	<span class="text-muted-foreground">{row.description ?? "—"}</span>
{/snippet}

{#snippet sizeCell(row: CollectionRow)}
	<span class="tabular-nums">{fmtBytes(row.sizeBytes)}</span>
{/snippet}

{#snippet durationCell(row: CollectionRow)}
	<span class="tabular-nums">{fmtDuration(row.durationMs)}</span>
{/snippet}

{#snippet samplesCell(row: CollectionRow)}
	<span class="tabular-nums">{row.sampleCount.toLocaleString()}</span>
{/snippet}

{#snippet dateCell(row: CollectionRow)}
	<span class="text-muted-foreground tabular-nums"
		>{fmtDate(row.createdAt)}</span
	>
{/snippet}

{#snippet actionsCell(row: CollectionRow)}
	<div class="flex items-center justify-end gap-1.5">
		<Button
			variant="outline"
			size="xs"
			disabled={loadingId === row.id}
			onclick={() => load(row)}
		>
			<DownloadIcon />
			{loadingId === row.id ? "Loading…" : "Load"}
		</Button>
		<Button variant="ghost" size="xs" onclick={() => onEdit(row)}>
			<PencilIcon />
		</Button>
		<Button
			variant="ghost"
			size="xs"
			class="text-destructive"
			onclick={() => onDelete(row)}
		>
			<Trash2Icon />
		</Button>
	</div>
{/snippet}

<div class="overflow-hidden rounded-xl">
	<Table.Root>
		<Table.Header>
			{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
				<Table.Row>
					{#each headerGroup.headers as header (header.id)}
						<Table.Head>
							{#if !header.isPlaceholder}
								<FlexRender
									content={header.column.columnDef.header}
									context={header.getContext()}
								/>
							{/if}
						</Table.Head>
					{/each}
				</Table.Row>
			{/each}
		</Table.Header>
		<Table.Body>
			{#each table.getRowModel().rows as row (row.id)}
				<Table.Row>
					{#each row.getVisibleCells() as cell (cell.id)}
						<Table.Cell>
							<FlexRender
								content={cell.column.columnDef.cell}
								context={cell.getContext()}
							/>
						</Table.Cell>
					{/each}
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</div>
