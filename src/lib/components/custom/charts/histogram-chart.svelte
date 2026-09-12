<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { BarChart } from "layerchart";
import {
	type ChartConfig,
	ChartContainer,
	Tooltip,
} from "$lib/components/ui/chart";

type HistSeries = {
	key: string;
	counts?: bigint[];
	label: string;
	color: string;
};

let {
	buckets,
	series,
	format,
	grouped = false,
	xTicks = 8,
	class: className = "aspect-auto h-56",
}: {
	/** Bucket boundaries (length = counts + 1), from collection metadata. */
	buckets?: number[];
	series: HistSeries[];
	/** Formats a bucket boundary for axis/tooltip labels. */
	format: (n: number) => string;
	/** Render series side-by-side (`group`) instead of overlaid. */
	grouped?: boolean;
	/** Approximate number of x-axis labels to show. */
	xTicks?: number;
	class?: string;
} = $props();

// Label a bucket by its upper bound.
function label(i: number): string {
	const hi = buckets?.[i + 1];
	if (hi === undefined) return `#${i}`;
	if (!Number.isFinite(hi)) return hi > 0 ? "∞" : "−∞";
	return format(hi);
}

const rows = $derived.by(() => {
	if (!series.length) return [];
	const n = Math.max(...series.map((s) => s.counts?.length ?? 0));
	if (n === 0) return [];

	const built = [];
	for (let i = 0; i < n; i++) {
		// `id` is the original bucket index (unique, ordinal) used as the x-axis
		// key; `label` is the formatted upper bound shown to the user. They are
		// kept separate because `format` can collapse distinct buckets to the
		// same label string, which would otherwise merge bars into one band.
		const row: Record<string, string | number> = {
			id: String(i),
			label: label(i),
		};
		let total = 0;
		for (const s of series) {
			const c = Number(s.counts?.[i] ?? 0);
			row[s.key] = c;
			total += c;
		}
		row.__total = total;
		built.push(row);
	}

	// Trim leading/trailing empty buckets so the populated range fills the chart.
	let start = 0;
	let end = built.length - 1;
	while (start < end && built[start].__total === 0) start++;
	while (end > start && built[end].__total === 0) end--;
	return built.slice(start, end + 1);
});

const hasDistribution = $derived(rows.length > 0);

// Map the ordinal x key (`id`) back to its display label for the axis and
// tooltip, since the bars are keyed by index, not the formatted bound.
const labelMap: Record<string, string> = $derived(
	Object.fromEntries(rows.map((r) => [String(r.id), String(r.label)])),
);

const config = $derived(
	Object.fromEntries(
		series.map((s) => [s.key, { label: s.label, color: s.color }]),
	) satisfies ChartConfig,
);

const chartSeries = $derived(
	series.map((s) => ({
		key: s.key,
		label: s.label,
		color: `var(--color-${s.key})`,
	})),
);
</script>

{#if hasDistribution}
	<ChartContainer {config} class={className}>
		<BarChart
			data={rows}
			x="id"
			y={series[0].key}
			yNice
			bandPadding={0.2}
			seriesLayout={grouped ? "group" : "overlap"}
			series={chartSeries}
			props={{
                xAxis: { ticks: xTicks, format: (v) => labelMap[String(v)] ?? "" },
            }}
		>
			{#snippet tooltip()}
				<Tooltip labelFormatter={(d) => `≤ ${labelMap[String(d)] ?? d}`} />
			{/snippet}
		</BarChart>
	</ChartContainer>
{:else}
	<div
		class="text-muted-foreground flex h-56 items-center justify-center text-sm"
	>
		No distribution recorded yet.
	</div>
{/if}
