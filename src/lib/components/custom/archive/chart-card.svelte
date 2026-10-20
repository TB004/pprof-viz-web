<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts" module>
// `id` is the unique key for Svelte/PieChart (collection names can collide);
// `label` is the human-readable display text.
export type Slice = { id: string; label: string; value: number; color: string };
</script>

<script lang="ts">
import { PieChart } from "layerchart";
import * as Card from "#lib/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	Tooltip,
} from "#lib/components/ui/chart";
import { ScrollArea } from "#lib/components/ui/scroll-area";
import { FormatUtils } from "#lib/utils";

let {
	title,
	description,
	slices,
	donut = false,
}: {
	title: string;
	description: string;
	slices: Slice[];
	donut?: boolean;
} = $props();

// Map slices to a ChartConfig so the themed Tooltip resolves each arc's label
// and color (and renders correctly in dark mode).
const config = $derived<ChartConfig>(
	Object.fromEntries(
		slices.map((s) => [s.id, { label: s.label, color: s.color }]),
	),
);

// Resolve a slice id back to its display label for the tooltip (layerchart
// passes the arc's key — the id — as the tooltip name).
const sliceLabels = $derived(new Map(slices.map((s) => [s.id, s.label])));
</script>

{#snippet byteTooltip({
	name,
	value,
}: {
	name: string;
	value: unknown;
})}
	<div class="flex w-full items-center justify-between gap-4">
		<span class="text-muted-foreground">{sliceLabels.get(name) ?? name}</span>
		<span class="font-mono font-medium"
			>{FormatUtils.fmtBytes(Number(value))}</span
		>
	</div>
{/snippet}

<Card.Root>
	<Card.Header>
		<Card.Title>{title}</Card.Title>
		<Card.Description>{description}</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		{#if slices.length > 0}
			<ChartContainer {config} class="mx-auto aspect-square h-44">
				<PieChart
					data={slices}
					key={(s: Slice) => s.id}
					value="value"
					label="label"
					c={(s: Slice) => s.id}
					cRange={slices.map((s) => s.color)}
					innerRadius={donut ? 0.62 : 0}
					padding={{ top: 4, bottom: 4 }}
				>
					{#snippet tooltip()}
						<Tooltip hideLabel nameKey="label" formatter={byteTooltip} />
					{/snippet}
				</PieChart>
			</ChartContainer>
			<ScrollArea
				type={slices.length > 4 ? "always" : "auto"}
				class={slices.length > 4 ? "h-24 pr-3" : ""}
			>
				<ul class="flex flex-col gap-1.5 text-xs">
					{#each slices as slice (slice.id)}
						<li class="flex items-center gap-2">
							<span
								class="size-2.5 shrink-0 rounded-full"
								style="background-color: {slice.color}"
							></span>
							<span class="truncate">{slice.label}</span>
							<span class="ml-auto tabular-nums text-muted-foreground">
								{FormatUtils.fmtBytes(slice.value)}
							</span>
						</li>
					{/each}
				</ul>
			</ScrollArea>
		{:else}
			<div
				class="flex h-44 items-center justify-center text-sm text-muted-foreground"
			>
				No data
			</div>
		{/if}
	</Card.Content>
</Card.Root>
