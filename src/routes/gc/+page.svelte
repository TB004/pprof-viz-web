<script lang="ts">
import {
	ActivityIcon,
	DatabaseIcon,
	RefreshCwIcon,
	ZapIcon,
} from "@lucide/svelte";
import { AreaChart, LineChart } from "layerchart";
import type { Component } from "svelte";
import * as Card from "$lib/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	Tooltip,
} from "$lib/components/ui/chart";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { fmtBytes, fmtBytesAxis } from "$lib/format";
import { CollectionService } from "$lib/services";

const collectionState = CollectionService.collectionState;

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

const heapChartConfig = {
	liveOccupiedBytes: { label: "Live Heap", color: "var(--chart-1)" },
	goalHeapSizeBytes: { label: "Heap Goal", color: "var(--chart-2)" },
} satisfies ChartConfig;

const allocChartConfig = {
	bytesAllocs: { label: "Allocated", color: "var(--chart-1)" },
	bytesFrees: { label: "Freed", color: "var(--chart-2)" },
} satisfies ChartConfig;

const cycleChartConfig = {
	automaticCycles: { label: "Automatic", color: "var(--chart-1)" },
	forcedCycles: { label: "Forced", color: "var(--chart-2)" },
} satisfies ChartConfig;
</script>

<ScrollArea class="h-full mr-2">
	<div class="flex min-h-full flex-col gap-6 p-6">
		<div>
			<h1 class="text-2xl font-semibold">GC</h1>
			<p class="text-muted-foreground text-sm">
				Garbage collector cycles, heap pressure, and allocation activity
			</p>
		</div>

		{#if !hasData}
			<div class="flex flex-1 items-center justify-center">
				<Card.Root class="w-fit border-dashed">
					<Card.Content
						class="flex flex-col items-center gap-3 px-16 py-12 text-center"
					>
						<div
							class="bg-muted flex h-12 w-12 items-center justify-center rounded-full"
						>
							<ActivityIcon class="text-muted-foreground size-6" />
						</div>
						<div>
							<p class="font-medium">No data yet</p>
							<p class="text-muted-foreground text-sm">
								Select a profile and start collecting to see GC metrics.
							</p>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
				{#each stats as { label, value, description, Icon } (label)}
					{@render statCard(label, value, description, Icon)}
				{/each}
			</div>

			<Card.Root>
				<Card.Header>
					<Card.Title>Heap Size</Card.Title>
					<Card.Description>
						Live heap and GC goal size over time
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<ChartContainer config={heapChartConfig} class="aspect-auto h-52">
						<AreaChart
							data={chartData}
							x="sample"
							yNice
							props={{ yAxis: { format: fmtBytesAxis } }}
							series={[
								{
									key: "liveOccupiedBytes",
									label: "Live Heap",
									color: "var(--color-liveOccupiedBytes)",
								},
								{
									key: "goalHeapSizeBytes",
									label: "Heap Goal",
									color: "var(--color-goalHeapSizeBytes)",
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
					<Card.Title>Allocation Activity</Card.Title>
					<Card.Description>
						Cumulative bytes allocated and freed over time
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<ChartContainer config={allocChartConfig} class="aspect-auto h-52">
						<AreaChart
							data={chartData}
							x="sample"
							yNice
							props={{ yAxis: { format: fmtBytesAxis } }}
							series={[
								{
									key: "bytesAllocs",
									label: "Allocated",
									color: "var(--color-bytesAllocs)",
								},
								{
									key: "bytesFrees",
									label: "Freed",
									color: "var(--color-bytesFrees)",
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
					<Card.Title>GC Cycles</Card.Title>
					<Card.Description>
						Cumulative automatic and forced GC cycles over time
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<ChartContainer config={cycleChartConfig} class="aspect-auto h-52">
						<LineChart
							data={chartData}
							x="sample"
							yNice
							props={{ yAxis: { format: fmtCompactAxis } }}
							series={[
								{
									key: "automaticCycles",
									label: "Automatic",
									color: "var(--color-automaticCycles)",
								},
								{
									key: "forcedCycles",
									label: "Forced",
									color: "var(--color-forcedCycles)",
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
	</div>
</ScrollArea>

{#snippet statCard(
	label: string,
	value: string,
	description: string,
	Icon: Component,
)}
	<Card.Root>
		<Card.Content class="p-4">
			<div class="flex items-center justify-between">
				<span class="text-muted-foreground text-xs font-medium">{label}</span>
				<Icon class="text-muted-foreground size-3.5" />
			</div>
			<div class="mt-2">
				<span class="font-mono text-xl font-semibold tabular-nums">
					{value}
				</span>
			</div>
			<p class="text-muted-foreground mt-1 text-xs">{description}</p>
		</Card.Content>
	</Card.Root>
{/snippet}
