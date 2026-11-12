<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts" module>
export type CompositionSlice = {
	key: string;
	label: string;
	value: number;
	color: string;
};
</script>

<script lang="ts">
import Panel from "./panel.svelte";

let {
	title,
	description,
	slices,
	format,
	totalLabel,
	class: className,
}: {
	title: string;
	description: string;
	slices: CompositionSlice[];
	format: (n: number) => string;
	/** What the headline figure is a total of, e.g. "live goroutines". */
	totalLabel: string;
	class?: string;
} = $props();

const total = $derived(slices.reduce((sum, s) => sum + s.value, 0));
const share = (v: number) => (total ? (v / total) * 100 : 0);
</script>

<Panel {title} {description} class={className}>
	<div class="flex flex-col gap-3.5 px-[18px] pt-3 pb-[18px]">
		<div>
			<div class="mono text-[30px] font-[550] tracking-[-0.02em]">
				{format(total)}
			</div>
			<p class="text-muted-foreground text-[12.5px]">{totalLabel}</p>
		</div>
		<div
			class="bg-grid flex h-3.5 gap-0.5 overflow-hidden rounded-[7px]"
			aria-hidden="true"
		>
			{#each slices as slice (slice.key)}
				<div
					class="h-full"
					style:width="{share(slice.value)}%"
					style:background={slice.color}
				></div>
			{/each}
		</div>
		<div class="flex flex-col">
			{#each slices as slice (slice.key)}
				<div
					class="border-line grid grid-cols-[12px_1fr_auto_52px] items-center gap-2.5 border-t py-2 text-[13px]"
				>
					<span
						class="size-[9px] rounded-[3px]"
						style:background={slice.color}
					></span>
					<span>{slice.label}</span>
					<span class="mono text-right">{format(slice.value)}</span>
					<span class="mono text-muted-foreground text-right">
						{share(slice.value).toFixed(1)}%
					</span>
				</div>
			{/each}
		</div>
	</div>
</Panel>
