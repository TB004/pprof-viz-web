<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { ActivityIcon, CpuIcon, TimerIcon, ZapIcon } from "@lucide/svelte";
import { AreaChart, LineChart } from "layerchart";
import { EmptyState, PageShell } from "$lib/components/custom/page";
import { StatGrid } from "$lib/components/custom/stat-card";
import * as Card from "$lib/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	Tooltip,
} from "$lib/components/ui/chart";
import { fmtSecs, fmtSecsAxis } from "$lib/format";
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

function fmtCompactAxis(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(Math.round(n));
}

const cpuChartConfig = {
	user: { label: "User", color: "var(--chart-1)" },
	idle: { label: "Idle", color: "var(--chart-2)" },
	gcTotal: { label: "GC", color: "var(--chart-3)" },
	scavengeTotal: {
		label: "Scavenge",
		color: "var(--chart-4)",
	},
} satisfies ChartConfig;

const gcChartConfig = {
	gcAssist: {
		label: "GC Assist",
		color: "var(--chart-1)",
	},
	gcDedicated: {
		label: "GC Dedicated",
		color: "var(--chart-2)",
	},
	gcPause: {
		label: "GC Pause",
		color: "var(--chart-3)",
	},
} satisfies ChartConfig;

const goroutineChartConfig = {
	goroutinesRunning: {
		label: "Running",
		color: "var(--chart-1)",
	},
	goroutinesRunnable: {
		label: "Runnable",
		color: "var(--chart-2)",
	},
	goroutinesWaiting: {
		label: "Waiting",
		color: "var(--chart-3)",
	},
} satisfies ChartConfig;
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

		<Card.Root>
			<Card.Header>
				<Card.Title>CPU Time Distribution</Card.Title>
				<Card.Description>
					User, idle, GC, and scavenge CPU seconds per sample
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<ChartContainer config={cpuChartConfig} class="aspect-auto h-52">
					<AreaChart
						data={chartData}
						x="sample"
						yNice
						padding={{ left: 35 }}
						props={{ yAxis: { format: fmtSecsAxis } }}
						series={[
                                {
                                    key: "user",
                                    label: "User",
                                    color: "var(--color-user)",
                                },
                                {
                                    key: "idle",
                                    label: "Idle",
                                    color: "var(--color-idle)",
                                },
                                {
                                    key: "gcTotal",
                                    label: "GC",
                                    color: "var(--color-gcTotal)",
                                },
                                {
                                    key: "scavengeTotal",
                                    label: "Scavenge",
                                    color: "var(--color-scavengeTotal)",
                                },
                            ]}
					>
						{#snippet tooltip()}
							<Tooltip labelFormatter={(d) => `Sample ${d}`} />
						{/snippet}
					</AreaChart>
				</ChartContainer>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>GC CPU Breakdown</Card.Title>
				<Card.Description>
					CPU seconds consumed by each GC phase per sample
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<ChartContainer config={gcChartConfig} class="aspect-auto h-52">
					<AreaChart
						data={chartData}
						x="sample"
						yNice
						padding={{ left: 35 }}
						props={{ yAxis: { format: fmtSecsAxis } }}
						series={[
                                {
                                    key: "gcAssist",
                                    label: "GC Assist",
                                    color: "var(--color-gcAssist)",
                                },
                                {
                                    key: "gcDedicated",
                                    label: "GC Dedicated",
                                    color: "var(--color-gcDedicated)",
                                },
                                {
                                    key: "gcPause",
                                    label: "GC Pause",
                                    color: "var(--color-gcPause)",
                                },
                            ]}
					>
						{#snippet tooltip()}
							<Tooltip labelFormatter={(d) => `Sample ${d}`} />
						{/snippet}
					</AreaChart>
				</ChartContainer>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Goroutine Activity</Card.Title>
				<Card.Description>
					Running, runnable, and waiting goroutines over time
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<ChartContainer config={goroutineChartConfig} class="aspect-auto h-52">
					<LineChart
						data={chartData}
						x="sample"
						yNice
						padding={{ left: 35 }}
						props={{ yAxis: { format: fmtCompactAxis } }}
						series={[
                                {
                                    key: "goroutinesRunning",
                                    label: "Running",
                                    color: "var(--color-goroutinesRunning)",
                                },
                                {
                                    key: "goroutinesRunnable",
                                    label: "Runnable",
                                    color: "var(--color-goroutinesRunnable)",
                                },
                                {
                                    key: "goroutinesWaiting",
                                    label: "Waiting",
                                    color: "var(--color-goroutinesWaiting)",
                                },
                            ]}
					>
						{#snippet tooltip()}
							<Tooltip labelFormatter={(d) => `Sample ${d}`} />
						{/snippet}
					</LineChart>
				</ChartContainer>
			</Card.Content>
		</Card.Root>
	{/if}
</PageShell>
