<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import type { Snippet } from "svelte";
import { ScrollArea } from "#lib/components/ui/scroll-area";

let {
	eyebrow,
	title,
	description,
	actions,
	children,
}: {
	/** A small label above the title. */
	eyebrow?: string;
	title: string;
	/** The line under the title; a snippet when it needs markup. */
	description?: string | Snippet;
	/** Trailing content on the header row, e.g. a toolbar. */
	actions?: Snippet;
	children: Snippet;
} = $props();
</script>

<ScrollArea class="h-full">
	<div class="flex min-h-full min-w-0 flex-col gap-5 px-4 pt-7 pb-10 sm:px-7">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div class="min-w-0">
				{#if eyebrow}
					<span class="eyebrow">{eyebrow}</span>
				{/if}
				<h1
					class="text-[26px] leading-[1.15] font-[650] tracking-[-0.02em] {eyebrow
						? "mt-1.5"
						: ""}"
				>
					{title}
				</h1>
				{#if description}
					<p class="text-muted-foreground mt-1.5 max-w-[680px] text-sm">
						{#if typeof description === "string"}
							{description}
						{:else}
							{@render description()}
						{/if}
					</p>
				{/if}
			</div>
			{@render actions?.()}
		</div>
		{@render children()}
	</div>
</ScrollArea>
