<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { LayersIcon } from "@lucide/svelte";
import { collectionService } from "#lib/app.svelte.js";
import CompositionChart from "#lib/components/composition-chart.svelte";
import MetricChart, {
	type ChartRow,
} from "#lib/components/metric-chart.svelte";
import StatGrid from "#lib/components/stat-grid.svelte";
import { fmtBytes, fmtBytesAxis } from "#lib/utils";
import DashboardShell from "../dashboard-shell.svelte";
import { windowed } from "../sample-window.svelte.js";

const collectionState = collectionService.getState();

const rows = $derived(
	(collectionState.data ?? []).map((frame, i): ChartRow => {
		const m = frame.memory;
		const n = (v: bigint | undefined) => Number(v ?? 0);
		const heapUnused = n(m?.heapUnusedBytes);
		const heapFree = n(m?.heapFreeBytes);
		const mcache = n(m?.mcacheInuseBytes) + n(m?.mcacheFreeBytes);
		const mspan = n(m?.mspanInuseBytes) + n(m?.mspanFreeBytes);
		const metadata =
			n(m?.otherMetadataBytes) + n(m?.profilingBucketBytes) + n(m?.otherBytes);
		return {
			sample: i + 1,
			at: collectionState.dataTimestamps?.[i],
			heapObject: n(m?.heapObjectBytes),
			heapUnused,
			heapFree,
			heapReleased: n(m?.heapReleasedBytes),
			heapIdle: heapUnused + heapFree,
			stacks: n(m?.heapStackBytes) + n(m?.osStackBytes),
			mcache,
			mspan,
			metadata,
			offHeap: mcache + mspan + metadata,
			total: n(m?.totalBytes),
		};
	}),
);

const data = $derived(windowed(rows));
const latest = $derived(rows.at(-1) ?? { sample: 0 });
const history = (key: string) => rows.slice(-40).map((r) => r[key] ?? 0);

const stat = (label: string, key: string, color: string) => ({
	label,
	value: fmtBytes(latest[key] ?? 0),
	history: history(key),
	color,
});

const stats = $derived([
	stat("Total mapped", "total", "var(--chart-1)"),
	stat("Heap in-use", "heapObject", "var(--chart-1)"),
	stat("Heap idle", "heapIdle", "var(--chart-2)"),
	stat("Released to OS", "heapReleased", "var(--chart-5)"),
	stat("Stacks", "stacks", "var(--chart-3)"),
	stat("Off-heap", "offHeap", "var(--chart-4)"),
]);

const composition = $derived([
	{
		key: "heapObject",
		label: "Heap in-use",
		value: latest.heapObject ?? 0,
		color: "var(--chart-1)",
	},
	{
		key: "heapIdle",
		label: "Heap idle",
		value: latest.heapIdle ?? 0,
		color: "var(--chart-2)",
	},
	{
		key: "heapReleased",
		label: "Released to OS",
		value: latest.heapReleased ?? 0,
		color: "var(--chart-5)",
	},
	{
		key: "stacks",
		label: "Stacks",
		value: latest.stacks ?? 0,
		color: "var(--chart-3)",
	},
	{
		key: "offHeap",
		label: "Off-heap",
		value: latest.offHeap ?? 0,
		color: "var(--chart-4)",
	},
]);
</script>

<DashboardShell
	title="Memory"
	icon={LayersIcon}
	description="How the runtime’s mapped memory splits between live heap, idle heap, stacks and runtime structures."
>
	<StatGrid {stats} />

	<div class="panel-grid">
		<CompositionChart
			title="Composition"
			description="Where memory lives in the latest sample."
			totalLabel="mapped by the runtime"
			format={fmtBytes}
			slices={composition}
		/>

		<MetricChart
			title="Heap breakdown"
			description="In-use, unused, free and released heap, stacked."
			{data}
			stacked
			format={fmtBytes}
			axisFormat={fmtBytesAxis}
			series={[
				{ key: "heapObject", label: "In-use", color: "var(--chart-1)" },
				{ key: "heapUnused", label: "Unused", color: "var(--chart-2)" },
				{ key: "heapFree", label: "Free", color: "var(--chart-3)" },
				{ key: "heapReleased", label: "Released", color: "var(--chart-5)" },
			]}
		/>

		<MetricChart
			title="Total footprint"
			description="Total mapped memory against the live heap."
			{data}
			format={fmtBytes}
			axisFormat={fmtBytesAxis}
			series={[
				{ key: "total", label: "Total" },
				{ key: "heapObject", label: "Heap in-use" },
			]}
		/>

		<MetricChart
			title="Runtime structures"
			description="Stacks, span and cache allocators, and metadata."
			{data}
			format={fmtBytes}
			axisFormat={fmtBytesAxis}
			series={[
				{ key: "stacks", label: "Stacks" },
				{ key: "metadata", label: "Metadata" },
				{ key: "mspan", label: "MSpan" },
				{ key: "mcache", label: "MCache" },
			]}
		/>
	</div>
</DashboardShell>
