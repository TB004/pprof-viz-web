<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts" module>
export type Stat = {
	label: string;
	value: string;
	/** The line under the value; a trend when omitted and `history` is set. */
	sub?: string;
	/** Recent values, drawn as a sparkline. */
	history?: number[];
	color?: string;
};
</script>

<script lang="ts">
import { trendLabel } from "#lib/utils";
import Sparkline from "./sparkline.svelte";

let { stats }: { stats: Stat[] } = $props();
</script>

<ul
	class="m-0 list-none p-0 border-line bg-line shadow-panel grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-px overflow-hidden rounded-panel border"
>
	{#each stats as stat (stat.label)}
		<li class="bg-surface flex min-w-0 flex-col gap-0.5 px-4 pt-3.5 pb-3">
			<span class="text-muted-foreground text-xs font-medium"
				>{stat.label}</span
			>
			<span
				class="mono truncate text-[22px] leading-[1.3] font-[550] tracking-[-0.02em]"
			>
				{stat.value}
			</span>
			<span class="text-muted-foreground truncate text-[11.5px]">
				{stat.sub ?? (stat.history ? trendLabel(stat.history) : "")}
			</span>
			{#if stat.history}
				<Sparkline
					values={stat.history.slice(-40)}
					color={stat.color ?? "var(--chart-1)"}
					class="mt-1.5 h-7 w-full overflow-visible"
				/>
			{/if}
		</li>
	{/each}
</ul>
