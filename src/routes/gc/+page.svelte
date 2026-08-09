<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	ActivityIcon,
	DatabaseIcon,
	RefreshCwIcon,
	ZapIcon,
} from "@lucide/svelte";
import { HistogramChart, MetricChart } from "$lib/components/custom/charts";
import { EmptyState, PageShell } from "$lib/components/custom/page";
import { StatGrid } from "$lib/components/custom/stat-card";
import * as Card from "$lib/components/ui/card";
import { fmtBytes, fmtBytesAxis } from "$lib/format";
import { CollectionService } from "$lib/services";

const collectionState = CollectionService.collectionState;

const latestGc = $derived($collectionState.data?.at(-1)?.gc);
const gcMeta = $derived($collectionState.metadata?.gc);

const chartData = $derived(
	($collectionState.data ?? []).map((frame, i) => ({
		sample: i + 1,
		liveOccupiedBytes: Number(frame.gc?.liveOccupiedBytes ?? 0),
		goalHeapSizeBytes: Number(frame.gc?.goalHeapSizeBytes ?? 0),
		bytesAllocs: Number(frame.gc?.bytesAllocs ?? 0),
		bytesFrees: Number(frame.gc?.bytesFrees ?? 0),
		objectsAllocs: Number(frame.gc?.objectsAllocs ?? 0),
		objectsFrees: Number(frame.gc?.objectsFrees ?? 0),
		automaticCycles: Number(frame.gc?.automaticCycles ?? 0),
		forcedCycles: Number(frame.gc?.forcedCycles ?? 0),
		totalCycles: Number(frame.gc?.totalCycles ?? 0),
		heapScannedBytes: Number(frame.gc?.heapScannedBytes ?? 0),
		stackScannedBytes: Number(frame.gc?.stackScannedBytes ?? 0),
		globalScannedBytes: Number(frame.gc?.globalScannedBytes ?? 0),
		objectsOccupied: Number(frame.gc?.objectsOccupied ?? 0),
	})),
);

const latest = $derived(chartData.at(-1));
const hasData = $derived(chartData.length > 0);

const stats = $derived([
	{
		label: "Total GC Cycles",
		value: (latest?.totalCycles ?? 0).toLocaleString(),
		description: "Cumulative GC cycles run",
		Icon: RefreshCwIcon,
	},
	{
		label: "Auto Cycles",
		value: (latest?.automaticCycles ?? 0).toLocaleString(),
		description: "GC cycles triggered automatically",
		Icon: ActivityIcon,
	},
	{
		label: "Forced Cycles",
		value: (latest?.forcedCycles ?? 0).toLocaleString(),
		description: "GC cycles forced by runtime.GC()",
		Icon: ZapIcon,
	},
	{
		label: "Live Heap",
		value: fmtBytes(latest?.liveOccupiedBytes ?? 0),
		description: "Currently live heap memory",
		Icon: DatabaseIcon,
	},
	{
		label: "Heap Goal",
		value: fmtBytes(latest?.goalHeapSizeBytes ?? 0),
		description: "Target heap size for next GC",
		Icon: DatabaseIcon,
	},
	{
		label: "Live Objects",
		value: (latest?.objectsOccupied ?? 0).toLocaleString(),
		description: "Number of live heap objects",
		Icon: ActivityIcon,
	},
]);

function fmtCompactAxis(n: number): string {
	if (n < 1_000) return String(Math.round(n));
	if (n < 100_000) return `${(n / 1_000).toFixed(1)}K`;
	if (n < 100_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	return `${(n / 1_000_000_000).toFixed(1)}B`;
}
</script>

<PageShell
	title="GC"
	description="Garbage collector cycles, heap pressure, and allocation activity"
>
	{#if !hasData}
		<EmptyState icon={ActivityIcon}>
			Select a profile and start collecting to see GC metrics.
		</EmptyState>
	{:else}
		<StatGrid {stats} />

		<MetricChart
			title="Heap Size"
			description="Live heap and GC goal size over time"
			data={chartData}
			format={fmtBytesAxis}
			series={[
				{ key: "liveOccupiedBytes", label: "Live Heap" },
				{ key: "goalHeapSizeBytes", label: "Heap Goal" },
			]}
		/>

		<MetricChart
			title="Allocation Activity"
			description="Cumulative bytes allocated and freed over time"
			data={chartData}
			format={fmtBytesAxis}
			series={[
				{ key: "bytesAllocs", label: "Allocated" },
				{ key: "bytesFrees", label: "Freed" },
			]}
		/>

		<MetricChart
			title="GC Cycles"
			description="Cumulative automatic and forced GC cycles over time"
			type="line"
			data={chartData}
			format={fmtCompactAxis}
			series={[
				{ key: "automaticCycles", label: "Automatic" },
				{ key: "forcedCycles", label: "Forced" },
			]}
		/>

		<Card.Root>
			<Card.Header>
				<Card.Title>Allocations by Size</Card.Title>
				<Card.Description>
					Cumulative bytes allocated and freed, grouped by object size class
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<HistogramChart
					buckets={gcMeta?.bytesAllocsBySizeBuckets}
					format={fmtBytesAxis}
					grouped
					series={[
						{
							key: "allocs",
							counts: latestGc?.bytesAllocsBySize?.counts,
							label: "Allocated",
							color: "var(--chart-1)",
						},
						{
							key: "frees",
							counts: latestGc?.bytesFreesBySize?.counts,
							label: "Freed",
							color: "var(--chart-2)",
						},
					]}
				/>
			</Card.Content>
		</Card.Root>
	{/if}
</PageShell>
