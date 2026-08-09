<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	BoxesIcon,
	HardDriveIcon,
	LayersIcon,
	MemoryStickIcon,
	RecycleIcon,
	WrenchIcon,
} from "@lucide/svelte";
import { AreaChart, LineChart, PieChart } from "layerchart";
import { EmptyState, PageShell } from "$lib/components/custom/page";
import { StatGrid } from "$lib/components/custom/stat-card";
import * as Card from "$lib/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	Tooltip,
} from "$lib/components/ui/chart";
import { fmtBytes, fmtBytesAxis } from "$lib/format";
import { CollectionService } from "$lib/services";

const collectionState = CollectionService.collectionState;

const chartData = $derived(
	($collectionState.data ?? []).map((frame, i) => {
		const m = frame.memory;
		const heapObject = Number(m?.heapObjectBytes ?? 0);
		const heapUnused = Number(m?.heapUnusedBytes ?? 0);
		const heapFree = Number(m?.heapFreeBytes ?? 0);
		const heapReleased = Number(m?.heapReleasedBytes ?? 0);
		const heapStack = Number(m?.heapStackBytes ?? 0);
		const osStack = Number(m?.osStackBytes ?? 0);
		const mcacheInuse = Number(m?.mcacheInuseBytes ?? 0);
		const mcacheFree = Number(m?.mcacheFreeBytes ?? 0);
		const mspanInuse = Number(m?.mspanInuseBytes ?? 0);
		const mspanFree = Number(m?.mspanFreeBytes ?? 0);
		const otherMetadata = Number(m?.otherMetadataBytes ?? 0);
		const profilingBucket = Number(m?.profilingBucketBytes ?? 0);
		const other = Number(m?.otherBytes ?? 0);

		return {
			sample: i + 1,
			heapObject,
			heapUnused,
			heapFree,
			heapReleased,
			heapIdle: heapUnused + heapFree,
			stacks: heapStack + osStack,
			offHeap:
				mcacheInuse +
				mcacheFree +
				mspanInuse +
				mspanFree +
				otherMetadata +
				profilingBucket +
				other,
			mcache: mcacheInuse + mcacheFree,
			mspan: mspanInuse + mspanFree,
			metadata: otherMetadata + profilingBucket + other,
			total: Number(m?.totalBytes ?? 0),
		};
	}),
);

const latest = $derived(chartData.at(-1));
const hasData = $derived(chartData.length > 0);

const composition = $derived([
	{
		key: "heapObject",
		label: "Heap In-Use",
		value: latest?.heapObject ?? 0,
	},
	{ key: "heapIdle", label: "Heap Idle", value: latest?.heapIdle ?? 0 },
	{
		key: "heapReleased",
		label: "Released to OS",
		value: latest?.heapReleased ?? 0,
	},
	{ key: "stacks", label: "Stacks", value: latest?.stacks ?? 0 },
	{ key: "offHeap", label: "Off-Heap", value: latest?.offHeap ?? 0 },
]);

const stats = $derived([
	{
		label: "Total",
		value: fmtBytes(latest?.total ?? 0),
		description: "Total memory mapped by the runtime",
		Icon: MemoryStickIcon,
	},
	{
		label: "Heap In-Use",
		value: fmtBytes(latest?.heapObject ?? 0),
		description: "Memory occupied by live objects",
		Icon: BoxesIcon,
	},
	{
		label: "Heap Idle",
		value: fmtBytes(latest?.heapIdle ?? 0),
		description: "Allocated heap not holding objects",
		Icon: HardDriveIcon,
	},
	{
		label: "Released",
		value: fmtBytes(latest?.heapReleased ?? 0),
		description: "Heap returned to the OS",
		Icon: RecycleIcon,
	},
	{
		label: "Stacks",
		value: fmtBytes(latest?.stacks ?? 0),
		description: "Goroutine and OS thread stacks",
		Icon: LayersIcon,
	},
	{
		label: "Off-Heap",
		value: fmtBytes(latest?.offHeap ?? 0),
		description: "Runtime structures and metadata",
		Icon: WrenchIcon,
	},
]);

const compositionChartConfig = {
	heapObject: { label: "Heap In-Use", color: "var(--chart-1)" },
	heapIdle: { label: "Heap Idle", color: "var(--chart-2)" },
	heapReleased: { label: "Released to OS", color: "var(--chart-3)" },
	stacks: { label: "Stacks", color: "var(--chart-4)" },
	offHeap: { label: "Off-Heap", color: "var(--chart-5)" },
} satisfies ChartConfig;

const heapChartConfig = {
	heapObject: { label: "In-Use", color: "var(--chart-1)" },
	heapUnused: { label: "Unused", color: "var(--chart-2)" },
	heapFree: { label: "Free", color: "var(--chart-3)" },
	heapReleased: { label: "Released", color: "var(--chart-4)" },
} satisfies ChartConfig;

const totalChartConfig = {
	total: { label: "Total", color: "var(--chart-1)" },
	heapObject: { label: "Heap In-Use", color: "var(--chart-2)" },
} satisfies ChartConfig;

const structuresChartConfig = {
	stacks: { label: "Stacks", color: "var(--chart-1)" },
	mspan: { label: "MSpan", color: "var(--chart-2)" },
	mcache: { label: "MCache", color: "var(--chart-3)" },
	metadata: { label: "Metadata", color: "var(--chart-4)" },
} satisfies ChartConfig;
</script>

<PageShell
	title="Memory"
	description="Heap composition, idle memory, and runtime structure footprint"
>
	{#if !hasData}
		<EmptyState icon={MemoryStickIcon}>
			Select a profile and start collecting to see memory metrics.
		</EmptyState>
	{:else}
		<StatGrid {stats} />

		<div class="grid gap-6 lg:grid-cols-[2fr_3fr]">
			<Card.Root>
				<Card.Header>
					<Card.Title>Memory Composition</Card.Title>
					<Card.Description>
						Where memory currently lives in the latest sample
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<ChartContainer
						config={compositionChartConfig}
						class="mx-auto h-64 w-full"
					>
						<PieChart
							data={composition}
							key="key"
							value="value"
							label="label"
							innerRadius={0.6}
							outerRadius={0.78}
							cRange={[
                                    "var(--chart-1)",
                                    "var(--chart-2)",
                                    "var(--chart-3)",
                                    "var(--chart-4)",
                                    "var(--chart-5)",
                                ]}
							c="key"
							labels={{
                                    value: (d) => d.label,
                                    class: "fill-foreground text-xs font-medium",
                                }}
						>
							{#snippet tooltip()}
								<Tooltip hideLabel nameKey="label" />
							{/snippet}
						</PieChart>
					</ChartContainer>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Heap Breakdown</Card.Title>
					<Card.Description>
						In-use, unused, free, and released heap over time
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<ChartContainer config={heapChartConfig} class="aspect-auto h-64">
						<AreaChart
							data={chartData}
							x="sample"
							yNice
							seriesLayout="stack"
							padding={{ left: 35 }}
							props={{ yAxis: { format: fmtBytesAxis } }}
							series={[
                                    {
                                        key: "heapObject",
                                        label: "In-Use",
                                        color: "var(--color-heapObject)",
                                    },
                                    {
                                        key: "heapUnused",
                                        label: "Unused",
                                        color: "var(--color-heapUnused)",
                                    },
                                    {
                                        key: "heapFree",
                                        label: "Free",
                                        color: "var(--color-heapFree)",
                                    },
                                    {
                                        key: "heapReleased",
                                        label: "Released",
                                        color: "var(--color-heapReleased)",
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
		</div>

		<Card.Root>
			<Card.Header>
				<Card.Title>Total Footprint</Card.Title>
				<Card.Description>
					Total mapped memory and live heap over time
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<ChartContainer config={totalChartConfig} class="aspect-auto h-52">
					<AreaChart
						data={chartData}
						x="sample"
						yNice
						padding={{ left: 35 }}
						props={{ yAxis: { format: fmtBytesAxis } }}
						series={[
                                {
                                    key: "total",
                                    label: "Total",
                                    color: "var(--color-total)",
                                },
                                {
                                    key: "heapObject",
                                    label: "Heap In-Use",
                                    color: "var(--color-heapObject)",
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
				<Card.Title>Runtime Structures</Card.Title>
				<Card.Description>
					Stacks, span/cache allocators, and metadata over time
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<ChartContainer config={structuresChartConfig} class="aspect-auto h-52">
					<LineChart
						data={chartData}
						x="sample"
						yNice
						padding={{ left: 35 }}
						props={{ yAxis: { format: fmtBytesAxis } }}
						series={[
                                {
                                    key: "stacks",
                                    label: "Stacks",
                                    color: "var(--color-stacks)",
                                },
                                {
                                    key: "mspan",
                                    label: "MSpan",
                                    color: "var(--color-mspan)",
                                },
                                {
                                    key: "mcache",
                                    label: "MCache",
                                    color: "var(--color-mcache)",
                                },
                                {
                                    key: "metadata",
                                    label: "Metadata",
                                    color: "var(--color-metadata)",
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
