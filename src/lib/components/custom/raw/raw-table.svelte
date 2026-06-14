<script lang="ts">
import { ChevronDownIcon, ChevronRightIcon } from "@lucide/svelte";
import { ScrollArea } from "$lib/components/ui/scroll-area";
import { CollectionService } from "$lib/services";
import { CollectionStatus, type Frame } from "$lib/types";

export type RowEntry = {
	sample: number;
	frame: Frame;
	arrivedAt: number | undefined;
};

type ColDef = {
	label: string;
	format: (frame: Frame) => string;
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

const collectionState = CollectionService.collectionState;

// ── internal state ─────────────────────────────────────────────────────────

let frozenRows = $state<RowEntry[] | null>(null);
let expandedCells = $state(new Set<string>());

// ── formatters ─────────────────────────────────────────────────────────────

function buildJson(raw: Record<string, unknown> | undefined): string {
	if (!raw) return "—";
	const cleaned: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(raw)) {
		if (v === undefined || v === null) continue;
		if (typeof v === "object" && ("counts" in v || "buckets" in v)) {
			const h = v as { counts?: unknown[]; buckets?: number[] };
			cleaned[k] =
				`<hist: ${h.counts?.length ?? 0} counts, ${h.buckets?.length ?? 0} buckets>`;
		} else {
			cleaned[k] = v;
		}
	}
	if (Object.keys(cleaned).length === 0) return "—";
	return JSON.stringify(cleaned, null, 2);
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
	{
		label: "CPUResponse",
		format: (f) => buildJson(f.cpu as Record<string, unknown> | undefined),
	},
	{
		label: "MemoryResponse",
		format: (f) => buildJson(f.memory as Record<string, unknown> | undefined),
	},
	{
		label: "GCResponse",
		format: (f) => buildJson(f.gc as Record<string, unknown> | undefined),
	},
	{
		label: "SchedulerResponse",
		format: (f) =>
			buildJson(f.scheduler as Record<string, unknown> | undefined),
	},
	{
		label: "GoDebugResponse",
		format: (f) => buildJson(f.goDebug as Record<string, unknown> | undefined),
	},
	{
		label: "CgoResponse",
		format: (f) => buildJson(f.cgo as Record<string, unknown> | undefined),
	},
	{
		label: "SyncResponse",
		format: (f) => buildJson(f.sync as Record<string, unknown> | undefined),
	},
];

// ── derived ────────────────────────────────────────────────────────────────

const isRunning = $derived(
	$collectionState.status === CollectionStatus.Running,
);

const allRows = $derived(
	($collectionState.data ?? [])
		.map((frame, i) => ({
			sample: i + 1,
			frame,
			arrivedAt: $collectionState.dataTimestamps?.[i],
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

<ScrollArea orientation="horizontal" class="rounded-md border border-border/60">
	<table class="w-full border-collapse text-xs">
		<thead class="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
			<tr class="border-b border-border/60">
				<th
					class="border-r border-border/40 px-3 py-2.5 text-center font-semibold text-muted-foreground whitespace-nowrap"
				>
					#
				</th>
				<th
					class="border-r border-border/40 px-3 py-2.5 text-center font-semibold text-muted-foreground whitespace-nowrap"
				>
					Time
				</th>
				{#each columns as col, i (col.label)}
					<th
						class={`px-3 py-2.5 text-center font-semibold text-muted-foreground whitespace-nowrap${i < columns.length - 1 ? " border-r border-border/40" : ""}`}
					>
						{col.label}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each pageRows as row (row.sample)}
				<tr
					class="border-b border-border/30 hover:bg-muted/20 align-top last:border-b-0"
				>
					<td
						class="border-r border-border/30 px-3 py-2.5 text-center font-mono text-muted-foreground whitespace-nowrap"
					>
						{row.sample}
					</td>
					<td
						class="border-r border-border/30 px-3 py-2.5 text-center font-mono text-muted-foreground whitespace-nowrap"
					>
						{fmtTimestamp(row.arrivedAt)}
					</td>
					{#each columns as col, colIdx (col.label)}
						{@const json = col.format(row.frame)}
						{@const isExpanded = expandedCells.has(
                            `${row.sample}-${colIdx}`,
                        )}
						<td
							class={`px-3 py-2.5 align-top text-center${colIdx < columns.length - 1 ? " border-r border-border/30" : ""}`}
						>
							{#if json === "—"}
								<span class="font-mono text-muted-foreground/40">—</span>
							{:else}
								<div class="flex flex-col items-center gap-1.5">
									<button
										type="button"
										class="flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
										onclick={() =>
                                            toggleCell(row.sample, colIdx)}
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
											orientation="horizontal"
											class="max-w-72 rounded-md bg-muted/50"
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
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</ScrollArea>
