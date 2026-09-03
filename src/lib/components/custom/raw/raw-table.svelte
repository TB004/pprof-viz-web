<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { ChevronDownIcon, ChevronRightIcon } from "@lucide/svelte";
import * as Card from "$lib/components/ui/card";
import { ScrollArea } from "$lib/components/ui/scroll-area";
import * as Table from "$lib/components/ui/table";
import { collectionService } from "$lib/services";
import {
	CollectionStatus,
	type Frame,
	type FrameGroup,
	type MetadataResponse,
} from "$lib/types";
import { FrameUtils } from "$lib/utils";

export type RowEntry = {
	sample: number;
	frame: Frame;
	arrivedAt: number | undefined;
};

type ColDef = {
	label: string;
	/** Frame field to render. For `gc`/`scheduler` this also names the
	 * metadata category that holds the matching histogram bucket boundaries. */
	field: FrameGroup;
};

let {
	currentPage,
	rowsPerPage,
	paused = $bindable(false),
	totalRows = $bindable(0),
}: {
	currentPage: number;
	rowsPerPage: number;
	paused: boolean;
	totalRows: number;
} = $props();

const collectionState = collectionService.getState();

// ── internal state ─────────────────────────────────────────────────────────

let frozenRows = $state<RowEntry[] | null>(null);
let expandedCells = $state(new Set<string>());

// ── formatters ─────────────────────────────────────────────────────────────

// Bucket boundaries are streamed once in metadata (keyed `<field>Buckets`),
// not in each frame, so frames carry counts-only histograms. Resolve the
// boundaries from metadata here so the raw view shows the full distribution.
function buildJson(
	raw: Record<string, unknown> | undefined,
	metaCategory: Record<string, number[] | undefined> | undefined,
): string {
	if (!raw) return "—";
	const cleaned: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(raw)) {
		if (v === undefined || v === null) continue;
		// Protobuf messages carry a `$typeName` marker that is not payload.
		if (k.startsWith("$")) continue;
		if (FrameUtils.isHistogram(v)) {
			const buckets = v.buckets.length
				? v.buckets
				: metaCategory?.[`${k}Buckets`];
			cleaned[k] = { counts: v.counts, buckets: buckets ?? [] };
		} else {
			cleaned[k] = v;
		}
	}
	if (Object.keys(cleaned).length === 0) return "—";
	// `uint64` fields are bigint, which `JSON.stringify` refuses to serialize.
	// Rendering them as strings matches proto3 JSON.
	return JSON.stringify(
		cleaned,
		(_key, value) => (typeof value === "bigint" ? value.toString() : value),
		2,
	);
}

// Render one frame field, pairing any histograms with their metadata buckets.
function cellJson(frame: Frame, field: FrameGroup): string {
	const raw = frame[field] as Record<string, unknown> | undefined;
	const metaCategory = (metadata as Record<string, unknown> | undefined)?.[
		field
	] as Record<string, number[] | undefined> | undefined;
	return buildJson(raw, metaCategory);
}

function fmtTimestamp(ms: number | undefined): string {
	if (ms === undefined) return "—";
	return new Date(ms).toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	} as Intl.DateTimeFormatOptions);
}

// ── columns ────────────────────────────────────────────────────────────────

const columns: ColDef[] = [
	{ label: "CPUResponse", field: "cpu" },
	{ label: "MemoryResponse", field: "memory" },
	{ label: "GCResponse", field: "gc" },
	{ label: "SchedulerResponse", field: "scheduler" },
	{ label: "GoDebugResponse", field: "goDebug" },
	{ label: "CgoResponse", field: "cgo" },
	{ label: "SyncResponse", field: "sync" },
];

// ── derived ────────────────────────────────────────────────────────────────

const isRunning = $derived(collectionState.status === CollectionStatus.Running);

const metadata = $derived<MetadataResponse | undefined>(
	collectionState.metadata,
);

const allRows = $derived(
	(collectionState.data ?? [])
		.map((frame, i) => ({
			sample: i + 1,
			frame,
			arrivedAt: collectionState.dataTimestamps?.[i],
		}))
		.reverse(),
);

const activeRows = $derived(
	paused && frozenRows !== null ? frozenRows : allRows,
);

const pageRows = $derived(
	activeRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
);

// ── effects ────────────────────────────────────────────────────────────────

// Reset to live when collection stops.
$effect(() => {
	if (!isRunning) {
		paused = false;
	}
});

// Snapshot allRows into frozenRows when pausing; clear when resuming.
$effect(() => {
	if (paused) {
		if (frozenRows === null) {
			frozenRows = [...allRows];
		}
	} else {
		frozenRows = null;
		expandedCells = new Set();
	}
});

// Expose active row count to parent for pagination math.
$effect(() => {
	totalRows = activeRows.length;
});

// ── actions ────────────────────────────────────────────────────────────────

function toggleCell(sample: number, colIdx: number) {
	if (!paused && isRunning) {
		frozenRows = [...allRows];
		paused = true;
	}
	const key = `${sample}-${colIdx}`;
	const next = new Set(expandedCells);
	if (next.has(key)) {
		next.delete(key);
	} else {
		next.add(key);
	}
	expandedCells = next;
}
</script>

<Card.Root class="py-0">
	<Card.Content class="p-0">
		<div class="overflow-hidden rounded-b-xl">
			<Table.Root>
				<Table.Header>
					<Table.Row class="bg-muted/50 hover:bg-muted/50">
						<Table.Head class="px-4 py-3 text-center text-muted-foreground">
							#
						</Table.Head>
						<Table.Head class="px-4 py-3 text-center text-muted-foreground">
							Time
						</Table.Head>
						{#each columns as col (col.label)}
							<Table.Head class="px-4 py-3 text-center text-muted-foreground">
								{col.label}
							</Table.Head>
						{/each}
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each pageRows as row (row.sample)}
						<Table.Row class="align-top hover:bg-muted/30">
							<Table.Cell
								class="px-4 py-2.5 text-center font-mono text-muted-foreground"
							>
								{row.sample}
							</Table.Cell>
							<Table.Cell
								class="px-4 py-2.5 text-center font-mono text-muted-foreground"
							>
								{fmtTimestamp(row.arrivedAt)}
							</Table.Cell>
							{#each columns as col, colIdx (col.label)}
								{@const json = cellJson(row.frame, col.field)}
								{@const isExpanded = expandedCells.has(
									`${row.sample}-${colIdx}`,
								)}
								<Table.Cell class="px-4 py-2.5 align-top text-center">
									{#if json === "—"}
										<span class="font-mono text-muted-foreground/40">—</span>
									{:else}
										<div class="flex flex-col items-center gap-1.5">
											<button
												type="button"
												class="flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
												onclick={() => toggleCell(row.sample, colIdx)}
											>
												{#if isExpanded}
													<ChevronDownIcon class="size-3 shrink-0" />
												{:else}
													<ChevronRightIcon class="size-3 shrink-0" />
												{/if}
												<span>expand</span>
											</button>

											{#if isExpanded}
												<ScrollArea
													orientation="both"
													class="h-64 max-w-72 rounded-md bg-muted/50"
												>
													<div class="p-2.5">
														<pre
															class="text-left text-[11px] font-mono leading-relaxed text-foreground/80"
														>{json}</pre>
													</div>
												</ScrollArea>
											{/if}
										</div>
									{/if}
								</Table.Cell>
							{/each}
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</Card.Content>
</Card.Root>
