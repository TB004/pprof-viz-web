<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import type { Snippet } from "svelte";

let {
	id,
	title,
	description,
	danger = false,
	children,
}: {
	/** The anchor the settings navigation links to. */
	id: string;
	title: string;
	description: string;
	danger?: boolean;
	children: Snippet;
} = $props();
</script>

<section
	{id}
	aria-labelledby="{id}-title"
	class="bg-surface shadow-panel scroll-mt-6 rounded-panel border {danger
		? "border-bad"
		: "border-line"}"
>
	<div class="px-5 pt-[18px]">
		<h2
			id="{id}-title"
			class="text-[14.5px] font-semibold {danger ? "text-bad" : ""}"
		>
			{title}
		</h2>
		<p class="text-muted-foreground mt-[3px] text-[12.5px]">{description}</p>
	</div>
	<div class="flex flex-col gap-[18px] px-5 pt-4 pb-5">
		{@render children()}
	</div>
</section>
