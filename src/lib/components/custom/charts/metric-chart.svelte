<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts" module>
export type MetricSeries = {
	/** Key into each data row. */
	key: string;
	label: string;
	/** Defaults to the categorical slot matching this series' position. */
	color?: string;
};
</script>

<script lang="ts">
import { AreaChart, LineChart } from "layerchart";
import type { Snippet } from "svelte";
import * as Card from "$lib/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	Tooltip,
} from "$lib/components/ui/chart";

let {
	title,
	description,
	type = "area",
	data,
	series,
	format,
	stacked = false,
	height = "h-52",
	tooltip,
}: {
	title: string;
	description: string;
	type?: "area" | "line";
	/** Rows keyed by `sample` plus one field per series. */
	data: Record<string, unknown>[];
	series: MetricSeries[];
	/** y-axis tick formatter; omitted leaves layerchart's default. */
	format?: (n: number) => string;
	/** Stack the areas instead of overlaying them. Ignored for lines. */
	stacked?: boolean;
	height?: string;
	/** Replaces the default per-sample tooltip. */
	tooltip?: Snippet;
} = $props();

// ChartContainer publishes a --color-<key> variable per config entry, which
// the series then reference — so each series' colour is declared once here
// rather than in a parallel config object.
const config = $derived(
	Object.fromEntries(
		series.map((s, i) => [
			s.key,
			{ label: s.label, color: s.color ?? `var(--chart-${i + 1})` },
		]),
	) satisfies ChartConfig,
);

const chartSeries = $derived(
	series.map((s) => ({
		key: s.key,
		label: s.label,
		color: `var(--color-${s.key})`,
	})),
);

const axisProps = $derived(format ? { yAxis: { format } } : undefined);
</script>

{#snippet sampleTooltip()}
	<Tooltip labelFormatter={(d) => `Sample ${d}`} />
{/snippet}

<Card.Root>
	<Card.Header>
		<Card.Title>{title}</Card.Title>
		<Card.Description>{description}</Card.Description>
	</Card.Header>
	<Card.Content>
		<ChartContainer {config} class="aspect-auto {height}">
			{#if type === "area"}
				<AreaChart
					{data}
					x="sample"
					yNice
					padding={{ left: 35 }}
					seriesLayout={stacked ? "stack" : "overlap"}
					props={axisProps}
					series={chartSeries}
					tooltip={tooltip ?? sampleTooltip}
				/>
			{:else}
				<LineChart
					{data}
					x="sample"
					yNice
					padding={{ left: 35 }}
					props={axisProps}
					series={chartSeries}
					tooltip={tooltip ?? sampleTooltip}
				/>
			{/if}
		</ChartContainer>
	</Card.Content>
</Card.Root>
