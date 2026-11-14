<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import type { Snippet } from "svelte";
import { cn } from "#lib/utils";

let {
	title,
	description,
	actions,
	class: className,
	children,
}: {
	title?: string;
	description?: string;
	/** Trailing content on the header row, e.g. a legend or a button. */
	actions?: Snippet;
	class?: string;
	children: Snippet;
} = $props();
</script>

<section
	class={cn(
		"border-line bg-surface shadow-panel min-w-0 rounded-panel border",
		className,
	)}
	aria-label={title}
>
	{#if title}
		<div
			class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5 px-[18px] pt-4 pb-1.5"
		>
			<div class="min-w-0">
				<h2 class="text-[14.5px] font-semibold tracking-[-0.005em]">{title}</h2>
				{#if description}
					<p class="text-muted-foreground mt-[3px] text-[12.5px]">
						{description}
					</p>
				{/if}
			</div>
			{@render actions?.()}
		</div>
	{/if}
	{@render children()}
</section>
