<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { RefreshCcwIcon } from "@lucide/svelte";
import { collectionService } from "#lib/app.svelte.js";
import HistogramChart from "#lib/components/histogram-chart.svelte";
import MetricChart, {
	type ChartRow,
} from "#lib/components/metric-chart.svelte";
import StatGrid from "#lib/components/stat-grid.svelte";
import {
	fmtBytes,
	fmtBytesAxis,
	fmtCount,
	fmtCountAxis,
	ratesPerSecond,
} from "#lib/utils";
import DashboardShell from "../dashboard-shell.svelte";
import { windowed } from "../sample-window.svelte.js";

const collectionState = collectionService.getState();

const latestGc = $derived(collectionState.data?.at(-1)?.gc);
const gcMeta = $derived(collectionState.metadata?.gc);

const rows = $derived.by((): ChartRow[] => {
	const frames = collectionState.data ?? [];
	const times = collectionState.dataTimestamps ?? [];
	const allocRate = ratesPerSecond(
		frames.map((f) => Number(f.gc?.bytesAllocs ?? 0)),
		times,
	);
	const freeRate = ratesPerSecond(
		frames.map((f) => Number(f.gc?.bytesFrees ?? 0)),
		times,
	);
	return frames.map((frame, i) => ({
		sample: i + 1,
		at: times[i],
		live: Number(frame.gc?.liveOccupiedBytes ?? 0),
		goal: Number(frame.gc?.goalHeapSizeBytes ?? 0),
		allocRate: allocRate[i],
		freeRate: freeRate[i],
		objects: Number(frame.gc?.objectsOccupied ?? 0),
		automatic: Number(frame.gc?.automaticCycles ?? 0),
		forced: Number(frame.gc?.forcedCycles ?? 0),
		total: Number(frame.gc?.totalCycles ?? 0),
	}));
});

const data = $derived(windowed(rows));
const history = (key: string) => rows.slice(-40).map((r) => r[key] ?? 0);
const fmtRate = (n: number) => `${fmtBytes(n)}/s`;

const stats = $derived.by(() => {
	const l = rows.at(-1) ?? { sample: 0 };
	const first = data[0]?.total ?? 0;
	const live = l.live ?? 0;
	const goal = l.goal ?? 0;
	return [
		{
			label: "Total cycles",
			value: fmtCount(l.total ?? 0),
			sub: `+${fmtCount((l.total ?? 0) - first)} in this window`,
			history: history("total"),
			color: "var(--chart-1)",
		},
		{
			label: "Automatic",
			value: fmtCount(l.automatic ?? 0),
			sub: "triggered by heap growth",
			history: history("automatic"),
			color: "var(--chart-1)",
		},
		{
			label: "Forced",
			value: fmtCount(l.forced ?? 0),
			sub: "via runtime.GC()",
			history: history("forced"),
			color: "var(--chart-2)",
		},
		{
			label: "Live heap",
			value: fmtBytes(live),
			history: history("live"),
			color: "var(--chart-1)",
		},
		{
			label: "Heap goal",
			value: fmtBytes(goal),
			sub: goal
				? `${Math.round((live / goal) * 100)}% of goal reached`
				: undefined,
			history: history("goal"),
			color: "var(--chart-2)",
		},
		{
			label: "Live objects",
			value: fmtCountAxis(l.objects ?? 0),
			history: history("objects"),
			color: "var(--chart-3)",
		},
	];
});
</script>

<DashboardShell
	title="Garbage collector"
	icon={RefreshCcwIcon}
	description="Cycles, heap pressure against the GC goal, and allocation throughput."
>
	<StatGrid {stats} />

	<div class="panel-grid">
		<MetricChart
			class="col-span-full"
			title="Heap vs. goal"
			description="Live heap climbs until it reaches the goal, then a cycle runs."
			{data}
			format={fmtBytes}
			axisFormat={fmtBytesAxis}
			series={[
				{ key: "live", label: "Live heap" },
				{ key: "goal", label: "Heap goal" },
			]}
		/>

		<MetricChart
			title="Allocation rate"
			description="Bytes allocated and freed per second, derived from the cumulative counters."
			{data}
			format={fmtRate}
			axisFormat={fmtBytesAxis}
			series={[
				{ key: "allocRate", label: "Allocated" },
				{ key: "freeRate", label: "Freed" },
			]}
		/>

		<MetricChart
			title="Live objects"
			description="Heap objects currently reachable."
			{data}
			fitMin
			format={fmtCount}
			axisFormat={fmtCountAxis}
			series={[{ key: "objects", label: "Objects", color: "var(--chart-3)" }]}
		/>

		<HistogramChart
			class="col-span-full"
			title="Allocations by size class"
			description="Cumulative heap allocations and frees, grouped by object size."
			buckets={gcMeta?.bytesAllocsBySizeBuckets}
			format={fmtBytesAxis}
			unit="objects"
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
	</div>
</DashboardShell>
