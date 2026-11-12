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

/** One sample: its 1-based number, when it arrived, and a value per series. */
export type ChartRow = { sample: number; at?: number } & Record<
	string,
	number | undefined
>;
</script>

<script lang="ts">
import { fmtTimeOfDay } from "#lib/utils";
import Panel from "./panel.svelte";

let {
	title,
	description,
	data,
	series,
	format,
	axisFormat = format,
	stacked = false,
	fitMin = false,
	class: className,
}: {
	title: string;
	description: string;
	data: ChartRow[];
	series: MetricSeries[];
	/** Formats a value for the legend and the tooltip. */
	format: (n: number) => string;
	/** Formats a y-axis tick; defaults to `format`. */
	axisFormat?: (n: number) => string;
	/** Stack the series as areas instead of overlaying lines. */
	stacked?: boolean;
	/** Start the y-axis near the smallest value instead of at zero. */
	fitMin?: boolean;
	class?: string;
} = $props();

// The plot is drawn in a fixed coordinate space and stretched to the panel;
// strokes keep their width through `vector-effect`.
const W = 600;
const H = 200;
const TICKS = [1, 0.75, 0.5, 0.25, 0];

let hidden = $state<Record<string, boolean>>({});
let hover = $state<number | null>(null);

const all = $derived(
	series.map((s, i) => ({
		...s,
		color: s.color ?? `var(--chart-${(i % 5) + 1})`,
		off: hidden[s.key] === true,
	})),
);
const visible = $derived(all.filter((s) => !s.off));

const value = (row: ChartRow, key: string) => row[key] ?? 0;

/** A round number at or above `v`: 1, 2, 2.5 or 5 times a power of ten. */
function nice(v: number): number {
	if (!(v > 0)) return 1;
	const e = 10 ** Math.floor(Math.log10(v));
	const f = v / e;
	return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}

const plot = $derived.by(() => {
	const n = data.length;
	let max = 0;
	let min = Number.POSITIVE_INFINITY;
	for (const row of data) {
		if (stacked) {
			let total = 0;
			for (const s of visible) total += value(row, s.key);
			max = Math.max(max, total);
			min = 0;
		} else {
			for (const s of visible) {
				max = Math.max(max, value(row, s.key));
				min = Math.min(min, value(row, s.key));
			}
		}
	}

	let lo = 0;
	let top: number;
	if (fitMin && Number.isFinite(min) && max > min) {
		const step = nice((max - min) / 3);
		lo = Math.max(0, Math.floor(min / step) * step - step);
		top = lo + step * 4;
		while (top < max) top += step;
	} else {
		top = nice(max * 1.08 || 1);
	}

	const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
	const y = (v: number) => H - ((v - lo) / (top - lo || 1)) * H;
	const pt = (i: number, v: number) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`;

	// Running totals, so each stacked area sits on the ones before it.
	const base = data.map(() => 0);
	const tops: Record<string, number[]> = {};
	const paths = visible.map((s, k) => {
		const below = base.slice();
		const v = data.map((row, i) =>
			stacked ? below[i] + value(row, s.key) : value(row, s.key),
		);
		if (stacked) for (let i = 0; i < v.length; i++) base[i] = v[i];
		tops[s.key] = v;

		const line = n > 1 ? `M${v.map((q, i) => pt(i, q)).join("L")}` : "";
		let area = "";
		if (n > 1 && stacked) {
			const floor = below.map((q, i) => pt(i, q)).reverse();
			area = `${line}L${floor.join("L")}Z`;
		} else if (n > 1 && k === 0) {
			area = `${line}L${pt(n - 1, lo)}L${pt(0, lo)}Z`;
		}
		return { key: s.key, color: s.color, line, area };
	});

	const yTicks = TICKS.map((f) => ({
		top: (1 - f) * 100,
		label: axisFormat(lo + (top - lo) * f),
		base: f === 0,
	}));

	const xTicks =
		n > 1
			? [...TICKS].reverse().map((f) => {
					const i = Math.round(f * (n - 1));
					return {
						left: (i / (n - 1)) * 100,
						label: `#${data[i].sample}`,
						align: f === 0 ? "start" : f === 1 ? "end" : "center",
					};
				})
			: [];

	return { n, y, paths, yTicks, xTicks, tops, totals: base };
});

const hovered = $derived.by(() => {
	if (hover === null || plot.n === 0) return null;
	const i = Math.min(hover, plot.n - 1);
	const row = data[i];
	const pct = plot.n <= 1 ? 50 : (i / (plot.n - 1)) * 100;
	const rows = visible.map((s) => ({
		label: s.label,
		color: s.color,
		value: format(value(row, s.key)),
	}));
	if (stacked && visible.length > 1) {
		rows.push({
			label: "Total",
			color: "transparent",
			value: format(plot.totals[i]),
		});
	}
	return {
		pct,
		title: `Sample #${row.sample}${row.at ? ` · ${fmtTimeOfDay(row.at)}` : ""}`,
		rows,
		dots: visible.map((s) => ({
			color: s.color,
			top: (plot.y(plot.tops[s.key][i]) / H) * 100,
		})),
	};
});

const latest = $derived(data.at(-1));

function track(event: PointerEvent) {
	const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
	if (rect.width === 0 || plot.n === 0) return;
	const f = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
	hover = Math.round(f * (plot.n - 1));
}

function toggle(key: string) {
	hidden = { ...hidden, [key]: !hidden[key] };
}
</script>

{#snippet legend()}
	<div class="flex flex-wrap justify-end gap-1">
		{#each all as s (s.key)}
			<button
				type="button"
				aria-pressed={!s.off}
				title="Show or hide {s.label}"
				class="text-ink-2 hover:bg-hover inline-flex h-[30px] cursor-pointer items-center gap-[7px] rounded-lg px-[9px] text-xs {s.off
					? "opacity-40"
					: ""}"
				onclick={() => toggle(s.key)}
			>
				<span
					class="size-[9px] shrink-0 rounded-[3px] {s.off
						? "border-faint border-[1.5px]"
						: ""}"
					style:background={s.off ? "transparent" : s.color}
				></span>
				{s.label}
				<span class="mono text-muted-foreground text-[11.5px]">
					{latest ? format(value(latest, s.key)) : "—"}
				</span>
			</button>
		{/each}
	</div>
{/snippet}

<Panel {title} {description} actions={legend} class={className}>
	<div
		class="grid grid-cols-[58px_minmax(0,1fr)] grid-rows-[208px_26px] pt-2.5 pr-[18px] pb-2 pl-1"
	>
		<div class="relative" aria-hidden="true">
			{#each plot.yTicks as tick (tick.top)}
				<span
					class="mono text-muted-foreground absolute right-2.5 -translate-y-1/2 text-[10.5px] whitespace-nowrap"
					style:top="{tick.top}%"
				>
					{tick.label}
				</span>
			{/each}
		</div>

		<div
			class="relative cursor-crosshair touch-none"
			role="presentation"
			onpointermove={track}
			onpointerdown={track}
			onpointerleave={() => (hover = null)}
		>
			{#each plot.yTicks as tick (tick.top)}
				<div
					class="absolute inset-x-0 border-t {tick.base
						? "border-line"
						: "border-grid border-dashed"}"
					style:top="{tick.top}%"
				></div>
			{/each}

			<svg
				viewBox="0 0 {W} {H}"
				preserveAspectRatio="none"
				class="pointer-events-none absolute inset-0 size-full overflow-visible"
				aria-hidden="true"
			>
				{#each plot.paths as path (path.key)}
					{#if path.area}
						<path
							d={path.area}
							fill={path.color}
							fill-opacity={stacked ? 0.24 : 0.09}
							stroke="none"
						/>
					{/if}
				{/each}
				{#each plot.paths as path (path.key)}
					<path
						d={path.line}
						fill="none"
						stroke={path.color}
						stroke-width="1.75"
						stroke-linejoin="round"
						stroke-linecap="round"
						vector-effect="non-scaling-stroke"
					/>
				{/each}
			</svg>

			{#if hovered}
				<div
					class="border-faint pointer-events-none absolute inset-y-0 w-0 border-l"
					style:left="{hovered.pct}%"
				></div>
				{#each hovered.dots as dot, i (i)}
					<div
						class="border-surface pointer-events-none absolute size-[9px] -translate-1/2 rounded-full border-2"
						style:left="{hovered.pct}%"
						style:top="{dot.top}%"
						style:background={dot.color}
					></div>
				{/each}
				<div
					class="bg-tip text-on-tip shadow-pop pointer-events-none absolute top-1.5 z-10 min-w-[180px] rounded-[10px] px-[11px] py-[9px] text-xs"
					style:left={hovered.pct > 55
						? undefined
						: `calc(${hovered.pct}% + 14px)`}
					style:right={hovered.pct > 55
						? `calc(${100 - hovered.pct}% + 14px)`
						: undefined}
				>
					<div class="mono text-tip-muted mb-1.5 text-[11px]">
						{hovered.title}
					</div>
					{#each hovered.rows as row (row.label)}
						<div class="flex items-center gap-2 py-0.5">
							<span
								class="size-[9px] shrink-0 rounded-[3px]"
								style:background={row.color}
							></span>
							<span>{row.label}</span>
							<span class="mono ml-auto pl-3.5">{row.value}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="relative col-start-2" aria-hidden="true">
			{#each plot.xTicks as tick (tick.left)}
				<span
					class="mono text-muted-foreground absolute top-2 text-[10.5px] {tick.align ===
					"start"
						? ""
						: tick.align === "end"
							? "-translate-x-full"
							: "-translate-x-1/2"}"
					style:left="{tick.left}%"
				>
					{tick.label}
				</span>
			{/each}
		</div>
	</div>
</Panel>
