<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { PencilIcon, TrashIcon, UploadIcon } from "@lucide/svelte";
import Chip from "#lib/components/chip.svelte";
import { Button } from "#lib/components/ui/button";
import { Checkbox } from "#lib/components/ui/checkbox";
import type { CollectionRow } from "#lib/types";
import { fmtBytes, fmtClock, fmtCount, fmtDateTime } from "#lib/utils";

let {
	collections,
	selectedIds = $bindable([]),
	loadingId,
	onLoad,
	onEdit,
	onDelete,
	onExport,
}: {
	collections: CollectionRow[];
	/** The rows ticked for a bulk export; owned by the page. */
	selectedIds?: string[];
	/** The row being loaded into the dashboards, if any. */
	loadingId: string | null;
	onLoad: (row: CollectionRow) => void;
	onEdit: (row: CollectionRow) => void;
	onDelete: (row: CollectionRow) => void;
	onExport: (row: CollectionRow) => void;
} = $props();

const allSelected = $derived(
	collections.length > 0 && selectedIds.length === collections.length,
);

function toggle(id: string) {
	selectedIds = selectedIds.includes(id)
		? selectedIds.filter((other) => other !== id)
		: [...selectedIds, id];
}

function toggleAll() {
	selectedIds = allSelected ? [] : collections.map((row) => row.id);
}
</script>

{#snippet header(
	label: string,
	className: string,
)}
	<th
		scope="col"
		class="text-muted-foreground h-[38px] px-1.5 text-left text-[11.5px] font-semibold tracking-[0.04em] uppercase {className}"
	>
		{label}
	</th>
{/snippet}

<div class="overflow-x-auto">
	<table
		aria-label="Saved collections"
		class="w-full min-w-[1000px] table-fixed border-collapse text-[13px]"
	>
		<thead class="bg-surface-2">
			<tr>
				<th scope="col" class="h-[38px] w-[44px] pr-1.5 pl-[18px]">
					<span class="flex">
						<Checkbox
							aria-label="Select every collection"
							checked={allSelected}
							indeterminate={selectedIds.length > 0 && !allSelected}
							onCheckedChange={toggleAll}
						/>
					</span>
				</th>
				{@render header("Name", "")}
				{@render header("Source", "w-[20%]")}
				{@render header("Mode", "w-[92px]")}
				{@render header("Duration", "w-[90px] text-right")}
				{@render header("Samples", "w-20 text-right")}
				{@render header("Size", "w-[84px] text-right")}
				{@render header("Saved", "w-[160px]")}
				<th scope="col" class="w-[208px] pr-[18px]">
					<span class="sr-only">Actions</span>
				</th>
			</tr>
		</thead>
		<tbody>
			{#each collections as row (row.id)}
				<tr class="group/row border-line hover:bg-hover h-[58px] border-t">
					<td class="pr-1.5 pl-[18px]">
						<span class="flex">
							<Checkbox
								aria-label="Select {row.name}"
								checked={selectedIds.includes(row.id)}
								onCheckedChange={() => toggle(row.id)}
							/>
						</span>
					</td>
					<td class="px-1.5">
						<span class="block truncate font-[550]">{row.name}</span>
						<span class="text-muted-foreground block truncate text-xs">
							{row.description ?? "No description"}
						</span>
					</td>
					<td class="px-1.5">
						<span class="block truncate">{row.profileName ?? "—"}</span>
						<span class="mono text-muted-foreground block truncate text-[11px]">
							{row.profileUrl ?? ""}
						</span>
					</td>
					<td class="px-1.5">
						{#if row.mode}
							<Chip>{row.mode}</Chip>
						{/if}
					</td>
					<td class="mono px-1.5 text-right">
						{fmtClock(row.durationMs / 1000)}
					</td>
					<td class="mono px-1.5 text-right">{fmtCount(row.sampleCount)}</td>
					<td class="mono px-1.5 text-right">{fmtBytes(row.sizeBytes)}</td>
					<td class="text-muted-foreground px-1.5 text-[12.5px]">
						{fmtDateTime(row.createdAt)}
					</td>
					<td class="pr-[18px] pl-1.5">
						<span
							class="flex justify-end gap-1 opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 max-md:opacity-100"
						>
							<Button
								variant="outline"
								size="sm"
								disabled={loadingId === row.id}
								onclick={() => onLoad(row)}
							>
								{loadingId === row.id ? "Opening…" : "Open"}
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Export {row.name}"
								title="Export as .ppvz"
								onclick={() => onExport(row)}
							>
								<UploadIcon />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Edit {row.name}"
								onclick={() => onEdit(row)}
							>
								<PencilIcon />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								class="text-bad hover:text-bad"
								aria-label="Delete {row.name}"
								onclick={() => onDelete(row)}
							>
								<TrashIcon />
							</Button>
						</span>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
