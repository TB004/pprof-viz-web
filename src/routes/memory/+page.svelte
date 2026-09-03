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
import { CompositionChart, MetricChart } from "$lib/components/custom/charts";
import { EmptyState, PageShell } from "$lib/components/custom/page";
import { StatGrid } from "$lib/components/custom/stat-card";
import { collectionService } from "$lib/services";
import { FormatUtils } from "$lib/utils";

const collectionState = collectionService.getState();

const chartData = $derived(
	(collectionState.data ?? []).map((frame, i) => {
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
		value: FormatUtils.fmtBytes(latest?.total ?? 0),
		description: "Total memory mapped by the runtime",
		Icon: MemoryStickIcon,
	},
	{
		label: "Heap In-Use",
		value: FormatUtils.fmtBytes(latest?.heapObject ?? 0),
		description: "Memory occupied by live objects",
		Icon: BoxesIcon,
	},
	{
		label: "Heap Idle",
		value: FormatUtils.fmtBytes(latest?.heapIdle ?? 0),
		description: "Allocated heap not holding objects",
		Icon: HardDriveIcon,
	},
	{
		label: "Released",
		value: FormatUtils.fmtBytes(latest?.heapReleased ?? 0),
		description: "Heap returned to the OS",
		Icon: RecycleIcon,
	},
	{
		label: "Stacks",
		value: FormatUtils.fmtBytes(latest?.stacks ?? 0),
		description: "Goroutine and OS thread stacks",
		Icon: LayersIcon,
	},
	{
		label: "Off-Heap",
		value: FormatUtils.fmtBytes(latest?.offHeap ?? 0),
		description: "Runtime structures and metadata",
		Icon: WrenchIcon,
	},
]);
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
			<CompositionChart
				title="Memory Composition"
				description="Where memory currently lives in the latest sample"
				slices={composition}
			/>

			<MetricChart
				title="Heap Breakdown"
				description="In-use, unused, free, and released heap over time"
				data={chartData}
				format={FormatUtils.fmtBytesAxis}
				stacked
				height="h-64"
				series={[
					{ key: "heapObject", label: "In-Use" },
					{ key: "heapUnused", label: "Unused" },
					{ key: "heapFree", label: "Free" },
					{ key: "heapReleased", label: "Released" },
				]}
			/>
		</div>

		<MetricChart
			title="Total Footprint"
			description="Total mapped memory and live heap over time"
			data={chartData}
			format={FormatUtils.fmtBytesAxis}
			series={[
				{ key: "total", label: "Total" },
				{ key: "heapObject", label: "Heap In-Use" },
			]}
		/>

		<MetricChart
			title="Runtime Structures"
			description="Stacks, span/cache allocators, and metadata over time"
			type="line"
			data={chartData}
			format={FormatUtils.fmtBytesAxis}
			series={[
				{ key: "stacks", label: "Stacks" },
				{ key: "mspan", label: "MSpan" },
				{ key: "mcache", label: "MCache" },
				{ key: "metadata", label: "Metadata" },
			]}
		/>
	{/if}
</PageShell>
