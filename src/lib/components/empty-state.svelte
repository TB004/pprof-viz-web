<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import type { Component, Snippet } from "svelte";

let {
	icon: Icon,
	title = "No data yet",
	action,
	children,
}: {
	icon: Component;
	title?: string;
	/** A call to action under the text. */
	action?: Snippet;
	/** The explanatory line under the title. */
	children: Snippet;
} = $props();
</script>

<div
	class="border-line-2 bg-surface flex flex-col items-center justify-center gap-2.5 rounded-panel border border-dashed px-6 py-16 text-center"
>
	<div
		class="bg-acc-soft text-acc flex size-12 items-center justify-center rounded-xl"
	>
		<Icon class="size-5" />
	</div>
	<p class="text-[15px] font-semibold">{title}</p>
	<p class="text-muted-foreground max-w-[380px] text-[13.5px]">
		{@render children()}
	</p>
	{#if action}
		<div class="mt-1.5">{@render action()}</div>
	{/if}
</div>
