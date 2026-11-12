<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { CpuIcon } from "@lucide/svelte";
import { collectionService } from "#lib/app.svelte.js";
import MetricChart, {
	type ChartRow,
} from "#lib/components/metric-chart.svelte";
import StatGrid from "#lib/components/stat-grid.svelte";
import { cpuSamples } from "#lib/session/metrics.js";
import {
	fmtCount,
	fmtCountAxis,
	fmtPercent,
	fmtSecs,
	fmtSecsAxis,
} from "#lib/utils";
import DashboardShell from "../dashboard-shell.svelte";
import { windowed } from "../sample-window.svelte.js";

const collectionState = collectionService.getState();

const rows = $derived.by((): ChartRow[] => {
	const frames = collectionState.data ?? [];
	const cpu = cpuSamples(frames);
	return frames.map((frame, i) => ({
		sample: i + 1,
		at: collectionState.dataTimestamps?.[i],
		...cpu[i],
		running: frame.scheduler?.runningGoroutines ?? 0,
		runnable: frame.scheduler?.runnableGoroutines ?? 0,
		live: frame.scheduler?.liveGoroutines ?? 0,
		gomaxprocs: frame.scheduler?.gomaxprocsThreads ?? 0,
	}));
});

const data = $derived(windowed(rows));
const latest = $derived(rows.at(-1));
const history = (key: string) => rows.slice(-40).map((r) => r[key] ?? 0);

const stats = $derived.by(() => {
	const l = latest ?? { sample: 0 };
	return [
		{
			label: "CPU utilisation",
			value: fmtPercent(l.utilisation ?? 0),
			history: history("utilisation"),
			color: "var(--chart-1)",
		},
		{
			label: "User",
			value: fmtSecs(l.user ?? 0),
			history: history("user"),
			color: "var(--chart-1)",
		},
		{
			label: "GC",
			value: fmtSecs(l.gc ?? 0),
			history: history("gc"),
			color: "var(--chart-2)",
		},
		{
			label: "Idle",
			value: fmtSecs(l.idle ?? 0),
			history: history("idle"),
			color: "var(--chart-5)",
		},
		{
			label: "Live goroutines",
			value: fmtCount(l.live ?? 0),
			history: history("live"),
			color: "var(--chart-3)",
		},
		{
			label: "GOMAXPROCS",
			value: fmtCount(l.gomaxprocs ?? 0),
			sub: "threads allowed to run Go",
			history: history("gomaxprocs"),
			color: "var(--chart-5)",
		},
	];
});
</script>

<DashboardShell
	title="CPU"
	icon={CpuIcon}
	description="Where CPU time goes each sample — user code, the garbage collector, the scavenger — and how busy the scheduler is."
>
	<StatGrid {stats} />

	<div class="panel-grid">
		<MetricChart
			class="col-span-full"
			title="CPU time distribution"
			description="CPU-seconds per sample, stacked. The total equals GOMAXPROCS × interval."
			{data}
			stacked
			format={fmtSecs}
			axisFormat={fmtSecsAxis}
			series={[
				{ key: "user", label: "User", color: "var(--chart-1)" },
				{ key: "gc", label: "GC", color: "var(--chart-2)" },
				{ key: "scavenge", label: "Scavenge", color: "var(--chart-3)" },
				{ key: "idle", label: "Idle", color: "var(--chart-5)" },
			]}
		/>

		<MetricChart
			title="GC CPU breakdown"
			description="CPU-seconds spent in each GC phase per sample."
			{data}
			format={fmtSecs}
			axisFormat={fmtSecsAxis}
			series={[
				{ key: "gcAssist", label: "Assist" },
				{ key: "gcDedicated", label: "Dedicated" },
				{ key: "gcPause", label: "Pause" },
			]}
		/>

		<MetricChart
			title="Goroutine activity"
			description="Running vs ready-to-run. Waiting goroutines live on the Scheduler page."
			{data}
			format={fmtCount}
			axisFormat={fmtCountAxis}
			series={[
				{ key: "running", label: "Running" },
				{ key: "runnable", label: "Runnable" },
			]}
		/>
	</div>
</DashboardShell>
