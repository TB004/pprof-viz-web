<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { HistoryIcon } from "@lucide/svelte";
import { collectionService } from "#lib/app.svelte.js";
import CompositionChart from "#lib/components/composition-chart.svelte";
import HistogramChart from "#lib/components/histogram-chart.svelte";
import MetricChart, {
	type ChartRow,
} from "#lib/components/metric-chart.svelte";
import StatGrid from "#lib/components/stat-grid.svelte";
import { fmtCount, fmtCountAxis, fmtSecsAxis } from "#lib/utils";
import DashboardShell from "../dashboard-shell.svelte";
import { windowed } from "../sample-window.svelte.js";

const collectionState = collectionService.getState();

// Histograms pair per-frame counts with bucket boundaries from metadata
// (boundaries are sent once, counts stream with each frame).
const schedMeta = $derived(collectionState.metadata?.scheduler);
const latestSched = $derived(collectionState.data?.at(-1)?.scheduler);

const rows = $derived(
	(collectionState.data ?? []).map(
		(frame, i): ChartRow => ({
			sample: i + 1,
			at: collectionState.dataTimestamps?.[i],
			running: frame.scheduler?.runningGoroutines ?? 0,
			runnable: frame.scheduler?.runnableGoroutines ?? 0,
			waiting: frame.scheduler?.waitingGoroutines ?? 0,
			notInGo: frame.scheduler?.notInGoGoroutines ?? 0,
			live: frame.scheduler?.liveGoroutines ?? 0,
			threads: frame.scheduler?.totalLiveThreads ?? 0,
			gomaxprocs: frame.scheduler?.gomaxprocsThreads ?? 0,
		}),
	),
);

const data = $derived(windowed(rows));
const latest = $derived(rows.at(-1) ?? { sample: 0 });
const history = (key: string) => rows.slice(-40).map((r) => r[key] ?? 0);

const stat = (label: string, key: string, color: string, sub?: string) => ({
	label,
	value: fmtCount(latest[key] ?? 0),
	sub,
	history: history(key),
	color,
});

const stats = $derived([
	stat("Live goroutines", "live", "var(--chart-1)"),
	stat("Running", "running", "var(--chart-1)"),
	stat("Runnable", "runnable", "var(--chart-2)"),
	stat("Waiting", "waiting", "var(--chart-5)"),
	stat(
		"GOMAXPROCS",
		"gomaxprocs",
		"var(--chart-5)",
		"threads allowed to run Go",
	),
	stat("OS threads", "threads", "var(--chart-3)"),
]);

const states = $derived([
	{
		key: "waiting",
		label: "Waiting",
		value: latest.waiting ?? 0,
		color: "var(--chart-5)",
	},
	{
		key: "running",
		label: "Running",
		value: latest.running ?? 0,
		color: "var(--chart-1)",
	},
	{
		key: "runnable",
		label: "Runnable",
		value: latest.runnable ?? 0,
		color: "var(--chart-2)",
	},
	{
		key: "notInGo",
		label: "Not in Go (syscall / cgo)",
		value: latest.notInGo ?? 0,
		color: "var(--chart-3)",
	},
]);
</script>

<DashboardShell
	title="Scheduler"
	icon={HistoryIcon}
	description="Goroutine states, scheduling latency and stop-the-world pauses."
>
	<StatGrid {stats} />

	<div class="panel-grid">
		<CompositionChart
			title="Goroutine states"
			description="How goroutines are distributed right now."
			totalLabel="goroutines"
			format={fmtCount}
			slices={states}
		/>

		<MetricChart
			title="Goroutines & threads"
			description="Running and runnable goroutines against live OS threads."
			{data}
			format={fmtCount}
			axisFormat={fmtCountAxis}
			series={[
				{ key: "running", label: "Running" },
				{ key: "runnable", label: "Runnable" },
				{ key: "threads", label: "OS threads" },
			]}
		/>

		<HistogramChart
			class="col-span-full"
			title="Scheduling latency"
			description="Time goroutines spent runnable before they got a thread."
			buckets={schedMeta?.latenciesSecondsBuckets}
			format={fmtSecsAxis}
			unit="goroutines"
			series={[
				{
					key: "count",
					counts: latestSched?.latenciesSeconds?.counts,
					label: "Goroutines",
					color: "var(--chart-1)",
				},
			]}
		/>

		<HistogramChart
			title="GC pause time"
			description="Stop-the-world pauses caused by the collector, by duration."
			buckets={schedMeta?.totalGcPauseSecondsBuckets}
			format={fmtSecsAxis}
			unit="pauses"
			series={[
				{
					key: "count",
					counts: latestSched?.totalGcPauseSeconds?.counts,
					label: "Pauses",
					color: "var(--chart-2)",
				},
			]}
		/>

		<HistogramChart
			title="Stop-the-world latency"
			description="Time to bring all goroutines to a halt for GC."
			buckets={schedMeta?.stoppingGcSecondsBuckets}
			format={fmtSecsAxis}
			unit="stops"
			series={[
				{
					key: "count",
					counts: latestSched?.stoppingGcSeconds?.counts,
					label: "Stops",
					color: "var(--chart-3)",
				},
			]}
		/>
	</div>
</DashboardShell>
