<script lang="ts">
import { BarChart } from "layerchart";
import {
	type ChartConfig,
	ChartContainer,
	Tooltip,
} from "$lib/components/ui/chart";

type Numeric = number | string;

type HistSeries = {
	key: string;
	counts?: Numeric[];
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

// Label a bucket by its upper bound; the topmost bound is +Inf in Go's
// runtime histograms, which we render as "∞".
// Label bucket `i` by its upper bound from metadata; the topmost bound is
// +Inf in Go's runtime histograms, rendered as "∞". When bucket boundaries
// are unavailable (metadata missing), fall back to the bucket index so the
// distribution still renders.
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
		const row: Record<string, string | number> = { label: label(i) };
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
			x="label"
			y={series[0].key}
			yNice
			bandPadding={0.2}
			seriesLayout={grouped ? "group" : "overlap"}
			series={chartSeries}
			props={{ xAxis: { ticks: xTicks } }}
		>
			{#snippet tooltip()}
				<Tooltip labelFormatter={(d) => `≤ ${d}`} />
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
