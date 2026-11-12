<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts" module>
export type HistSeries = {
	key: string;
	counts?: bigint[];
	label: string;
	color: string;
};
</script>

<script lang="ts">
import Panel from "./panel.svelte";

let {
	title,
	description,
	buckets,
	series,
	format,
	unit,
	class: className,
}: {
	title: string;
	description: string;
	/** Bucket boundaries (length = counts + 1), from collection metadata. */
	buckets?: number[];
	series: HistSeries[];
	/** Formats a bucket boundary for labels. */
	format: (n: number) => string;
	/** What a count is, for the tooltip, e.g. "pauses". */
	unit: string;
	class?: string;
} = $props();

/** Roughly how many bucket labels fit under the bars. */
const LABELS = 10;

let hidden = $state<Record<string, boolean>>({});
let hover = $state<number | null>(null);

const visible = $derived(series.filter((s) => !hidden[s.key]));

// Label a bucket by its upper bound.
function label(i: number): string {
	const hi = buckets?.[i + 1];
	if (hi === undefined) return `#${i}`;
	if (!Number.isFinite(hi)) return hi > 0 ? "∞" : "−∞";
	return format(hi);
}

const bars = $derived.by(() => {
	const n = Math.max(0, ...series.map((s) => s.counts?.length ?? 0));
	const rows = Array.from({ length: n }, (_, i) => ({
		label: label(i),
		counts: series.map((s) => Number(s.counts?.[i] ?? 0)),
	}));

	// Trim leading/trailing empty buckets so the populated range fills the chart.
	const empty = (r: (typeof rows)[number]) => r.counts.every((c) => c === 0);
	let start = 0;
	let end = rows.length - 1;
	while (start < end && empty(rows[start])) start++;
	while (end > start && empty(rows[end])) end--;
	const shown = rows.slice(start, end + 1);
	if (shown.every(empty)) return [];

	let max = 0;
	for (const r of shown) {
		series.forEach((s, k) => {
			if (!hidden[s.key]) max = Math.max(max, r.counts[k]);
		});
	}
	const every = Math.ceil(shown.length / LABELS);
	return shown.map((r, i) => ({
		...r,
		showLabel: i % every === 0,
		heights: r.counts.map((c) => (max ? (c / max) * 100 : 0)),
	}));
});

const dense = $derived(bars.length > 30);
const tip = $derived(hover === null ? null : bars[hover]);
</script>

{#snippet legend()}
	{#if series.length > 1}
		<div class="flex flex-wrap justify-end gap-1">
			{#each series as s (s.key)}
				<button
					type="button"
					aria-pressed={!hidden[s.key]}
					title="Show or hide {s.label}"
					class="text-ink-2 hover:bg-hover inline-flex h-[30px] cursor-pointer items-center gap-[7px] rounded-lg px-[9px] text-xs {hidden[
						s.key
					]
						? "opacity-40"
						: ""}"
					onclick={() => (hidden = { ...hidden, [s.key]: !hidden[s.key] })}
				>
					<span
						class="size-[9px] shrink-0 rounded-[3px]"
						style:background={hidden[s.key] ? "transparent" : s.color}
						style:border={hidden[s.key]
							? "1.5px solid var(--faint)"
							: undefined}
					></span>
					{s.label}
				</button>
			{/each}
		</div>
	{/if}
{/snippet}

<Panel {title} {description} actions={legend} class={className}>
	{#if bars.length > 0}
		<div class="relative px-[18px] pt-3.5 pb-4">
			<div
				class="flex items-end {dense ? "gap-px" : "gap-1.5"}"
				role="presentation"
				onpointerleave={() => (hover = null)}
			>
				{#each bars as bar, i (i)}
					<div
						class="flex min-w-0 flex-1 flex-col items-stretch gap-2"
						role="presentation"
						onpointerenter={() => (hover = i)}
					>
						<div
							class="border-line flex h-44 items-end gap-0.5 border-b {hover ===
							i
								? "bg-hover"
								: ""}"
						>
							{#each series as s, k (s.key)}
								{#if !hidden[s.key]}
									<div
										class="flex-1 rounded-t-[4px]"
										style:height="{bar.heights[k]}%"
										style:min-height={bar.counts[k] > 0 ? "2px" : "0"}
										style:background={s.color}
									></div>
								{/if}
							{/each}
						</div>
						<span
							class="mono text-muted-foreground overflow-visible text-center text-[10.5px] whitespace-nowrap"
						>
							{bar.showLabel ? bar.label : " "}
						</span>
					</div>
				{/each}
			</div>

			{#if tip}
				<div
					class="bg-tip text-on-tip shadow-pop pointer-events-none absolute top-2 right-[18px] z-10 min-w-[180px] rounded-[10px] px-[11px] py-[9px] text-xs"
				>
					<div class="mono text-tip-muted mb-1.5 text-[11px]">
						≤ {tip.label}
					</div>
					{#each series as s, k (s.key)}
						{#if !hidden[s.key]}
							<div class="flex items-center gap-2 py-0.5">
								<span
									class="size-[9px] shrink-0 rounded-[3px]"
									style:background={s.color}
								></span>
								<span>{s.label}</span>
								<span class="mono ml-auto pl-3.5">
									{tip.counts[k].toLocaleString("en-US")}
									{unit}
								</span>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div
			class="text-muted-foreground flex h-56 items-center justify-center text-sm"
		>
			No distribution recorded yet.
		</div>
	{/if}
	<!-- Hiding every series would otherwise leave a silent, empty plot. -->
	{#if visible.length === 0 && bars.length > 0}
		<p class="text-muted-foreground px-[18px] pb-4 text-xs">
			Every series is hidden.
		</p>
	{/if}
</Panel>
