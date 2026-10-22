<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts" module>
export type CompositionSlice = {
	/** Unique key; also selects the categorical colour slot by position. */
	key: string;
	label: string;
	value: number;
};
</script>

<script lang="ts">
import { PieChart } from "layerchart";
import * as Card from "#lib/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	Tooltip,
} from "#lib/components/ui/chart";

let {
	title,
	description,
	slices,
}: {
	title: string;
	description: string;
	slices: CompositionSlice[];
} = $props();

const config = $derived(
	Object.fromEntries(
		slices.map((s, i) => [
			s.key,
			{ label: s.label, color: `var(--chart-${i + 1})` },
		]),
	) satisfies ChartConfig,
);

const cRange = $derived(slices.map((_, i) => `var(--chart-${i + 1})`));
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{title}</Card.Title>
		<Card.Description>{description}</Card.Description>
	</Card.Header>
	<Card.Content>
		<ChartContainer {config} class="mx-auto h-64 w-full">
			<PieChart
				data={slices}
				key="key"
				value="value"
				label="label"
				innerRadius={0.6}
				outerRadius={0.78}
				{cRange}
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
