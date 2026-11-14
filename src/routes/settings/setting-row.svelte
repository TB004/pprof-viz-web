<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import type { Snippet } from "svelte";

let {
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	/** The control on the right. */
	children: Snippet;
} = $props();
</script>

<div
	class="border-line flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t pt-4 first:border-t-0 first:pt-0"
>
	<div>
		<div class="text-[13.5px] font-[550]">{title}</div>
		<div class="text-muted-foreground mt-0.5 max-w-[460px] text-[13px]">
			{description}
		</div>
	</div>
	{@render children()}
</div>
