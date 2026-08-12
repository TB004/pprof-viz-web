<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { ActivityIcon, CpuIcon, TimerIcon, ZapIcon } from "@lucide/svelte";
import { MetricChart } from "$lib/components/custom/charts";
import { EmptyState, PageShell } from "$lib/components/custom/page";
import { StatGrid } from "$lib/components/custom/stat-card";
import { fmtCountAxis, fmtSecs, fmtSecsAxis } from "$lib/format";
import { CollectionService } from "$lib/services";

const collectionState = CollectionService.collectionState;

const chartData = $derived(
	($collectionState.data ?? []).map((frame, i) => ({
		sample: i + 1,
		user: frame.cpu?.userSeconds ?? 0,
		idle: frame.cpu?.idleSeconds ?? 0,
		total: frame.cpu?.totalSeconds ?? 0,
		gcTotal: frame.cpu?.gcTotalSeconds ?? 0,
		scavengeTotal: frame.cpu?.scavengeTotalSeconds ?? 0,
		gcAssist: frame.cpu?.gcAssistSeconds ?? 0,
		gcDedicated: frame.cpu?.gcDedicatedSeconds ?? 0,
		gcPause: frame.cpu?.gcPauseSeconds ?? 0,
		goroutinesRunnable: frame.scheduler?.runnableGoroutines ?? 0,
		goroutinesRunning: frame.scheduler?.runningGoroutines ?? 0,
		goroutinesWaiting: frame.scheduler?.waitingGoroutines ?? 0,
		goroutinesLive: frame.scheduler?.liveGoroutines ?? 0,
		gomaxprocs: frame.scheduler?.gomaxprocsThreads ?? 0,
	})),
);

const latest = $derived(chartData.at(-1));
const hasData = $derived(chartData.length > 0);

const stats = $derived([
	{
		label: "User CPU",
		value: fmtSecs(latest?.user ?? 0),
		description: "CPU time in user code",
		Icon: CpuIcon,
	},
	{
		label: "Total CPU",
		value: fmtSecs(latest?.total ?? 0),
		description: "Total measured CPU time",
		Icon: TimerIcon,
	},
	{
		label: "GC CPU",
		value: fmtSecs(latest?.gcTotal ?? 0),
		description: "CPU time in garbage collection",
		Icon: ZapIcon,
	},
	{
		label: "Live Goroutines",
		value: (latest?.goroutinesLive ?? 0).toLocaleString(),
		description: "Total live goroutines",
		Icon: ActivityIcon,
	},
	{
		label: "Running",
		value: (latest?.goroutinesRunning ?? 0).toLocaleString(),
		description: "Goroutines currently executing",
		Icon: ActivityIcon,
	},
	{
		label: "GOMAXPROCS",
		value: (latest?.gomaxprocs ?? 0).toLocaleString(),
		description: "OS threads for goroutines",
		Icon: CpuIcon,
	},
]);
</script>

<PageShell
	title="CPU"
	description="CPU time breakdown and goroutine scheduling activity"
>
	{#if !hasData}
		<EmptyState icon={CpuIcon}>
			Select a profile and start collecting to see CPU metrics.
		</EmptyState>
	{:else}
		<StatGrid {stats} />

		<MetricChart
			title="CPU Time Distribution"
			description="User, idle, GC, and scavenge CPU seconds per sample"
			data={chartData}
			format={fmtSecsAxis}
			series={[
				{ key: "user", label: "User" },
				{ key: "idle", label: "Idle" },
				{ key: "gcTotal", label: "GC" },
				{ key: "scavengeTotal", label: "Scavenge" },
			]}
		/>

		<MetricChart
			title="GC CPU Breakdown"
			description="CPU seconds consumed by each GC phase per sample"
			data={chartData}
			format={fmtSecsAxis}
			series={[
				{ key: "gcAssist", label: "GC Assist" },
				{ key: "gcDedicated", label: "GC Dedicated" },
				{ key: "gcPause", label: "GC Pause" },
			]}
		/>

		<MetricChart
			title="Goroutine Activity"
			description="Running, runnable, and waiting goroutines over time"
			type="line"
			data={chartData}
			format={fmtCountAxis}
			series={[
				{ key: "goroutinesRunning", label: "Running" },
				{ key: "goroutinesRunnable", label: "Runnable" },
				{ key: "goroutinesWaiting", label: "Waiting" },
			]}
		/>
	{/if}
</PageShell>
