<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	ActivityIcon,
	CpuIcon,
	GaugeIcon,
	HourglassIcon,
	LayersIcon,
	PlayIcon,
} from "@lucide/svelte";
import {
	CompositionChart,
	HistogramChart,
	MetricChart,
} from "$lib/components/custom/charts";
import { EmptyState, PageShell } from "$lib/components/custom/page";
import { StatGrid } from "$lib/components/custom/stat-card";
import * as Card from "$lib/components/ui/card";
import { collectionService } from "$lib/services";
import { FormatUtils } from "$lib/utils";

const collectionState = collectionService.getState();

const frames = $derived(collectionState.data ?? []);
const metadata = $derived(collectionState.metadata);
const hasData = $derived(frames.length > 0);
const latest = $derived(frames.at(-1)?.scheduler);

const chartData = $derived(
	frames.map((frame, i) => ({
		sample: i + 1,
		running: frame.scheduler?.runningGoroutines ?? 0,
		runnable: frame.scheduler?.runnableGoroutines ?? 0,
		waiting: frame.scheduler?.waitingGoroutines ?? 0,
		live: frame.scheduler?.liveGoroutines ?? 0,
		threads: frame.scheduler?.totalLiveThreads ?? 0,
	})),
);

const composition = $derived([
	{
		key: "running",
		label: "Running",
		value: latest?.runningGoroutines ?? 0,
	},
	{
		key: "runnable",
		label: "Runnable",
		value: latest?.runnableGoroutines ?? 0,
	},
	{
		key: "waiting",
		label: "Waiting",
		value: latest?.waitingGoroutines ?? 0,
	},
	{
		key: "notInGo",
		label: "Not in Go",
		value: latest?.notInGoGoroutines ?? 0,
	},
]);

const stats = $derived([
	{
		label: "Live Goroutines",
		value: (latest?.liveGoroutines ?? 0).toLocaleString(),
		description: "Goroutines that currently exist",
		Icon: ActivityIcon,
	},
	{
		label: "Running",
		value: (latest?.runningGoroutines ?? 0).toLocaleString(),
		description: "Goroutines executing on a thread",
		Icon: PlayIcon,
	},
	{
		label: "Runnable",
		value: (latest?.runnableGoroutines ?? 0).toLocaleString(),
		description: "Ready goroutines awaiting a thread",
		Icon: GaugeIcon,
	},
	{
		label: "Waiting",
		value: (latest?.waitingGoroutines ?? 0).toLocaleString(),
		description: "Goroutines blocked or sleeping",
		Icon: HourglassIcon,
	},
	{
		label: "GOMAXPROCS",
		value: (latest?.gomaxprocsThreads ?? 0).toLocaleString(),
		description: "Threads allowed to run Go code",
		Icon: CpuIcon,
	},
	{
		label: "OS Threads",
		value: (latest?.totalLiveThreads ?? 0).toLocaleString(),
		description: "Total live OS threads",
		Icon: LayersIcon,
	},
]);

// Histograms pair per-frame counts with bucket boundaries from metadata
// (boundaries are sent once, counts stream with each frame).
const schedMeta = $derived(metadata?.scheduler);
</script>

<PageShell
	title="Scheduler"
	description="Goroutine states, scheduling latency, and stop-the-world pauses"
>
	{#if !hasData}
		<EmptyState icon={ActivityIcon}>
			Select a profile and start collecting to see scheduler metrics.
		</EmptyState>
	{:else}
		<StatGrid {stats} />

		<div class="grid gap-6 lg:grid-cols-[2fr_3fr]">
			<CompositionChart
				title="Goroutine States"
				description="How goroutines are distributed right now"
				slices={composition}
			/>

			<MetricChart
				title="Goroutines & Threads"
				description="Running, runnable, waiting goroutines and OS threads over time"
				type="line"
				data={chartData}
				height="h-64"
				series={[
					{ key: "running", label: "Running" },
					{ key: "runnable", label: "Runnable" },
					{ key: "waiting", label: "Waiting" },
					{ key: "threads", label: "OS Threads" },
				]}
			/>
		</div>

		<Card.Root>
			<Card.Header>
				<Card.Title>Scheduling Latency</Card.Title>
				<Card.Description>
					Time goroutines spent waiting to run, by duration bucket
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<HistogramChart
					buckets={schedMeta?.latenciesSecondsBuckets}
					format={FormatUtils.fmtSecsAxis}
					series={[
						{
							key: "count",
							counts: latest?.latenciesSeconds?.counts,
							label: "Goroutines",
							color: "var(--chart-1)",
						},
					]}
				/>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>GC Pause Time</Card.Title>
				<Card.Description>
					Total stop-the-world pauses for garbage collection, by duration
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<HistogramChart
					buckets={schedMeta?.totalGcPauseSecondsBuckets}
					format={FormatUtils.fmtSecsAxis}
					series={[
						{
							key: "count",
							counts: latest?.totalGcPauseSeconds?.counts,
							label: "Pauses",
							color: "var(--chart-3)",
						},
					]}
				/>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Stop-the-World Latency</Card.Title>
				<Card.Description>
					Time to bring all goroutines to a stop for GC, by duration
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<HistogramChart
					buckets={schedMeta?.stoppingGcSecondsBuckets}
					format={FormatUtils.fmtSecsAxis}
					series={[
						{
							key: "count",
							counts: latest?.stoppingGcSeconds?.counts,
							label: "Stops",
							color: "var(--chart-4)",
						},
					]}
				/>
			</Card.Content>
		</Card.Root>
	{/if}
</PageShell>
