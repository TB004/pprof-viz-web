<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import type { Snippet } from "svelte";
import { ScrollArea } from "$lib/components/ui/scroll-area";

let {
	title,
	description,
	actions,
	children,
}: {
	title: string;
	description: string;
	/** Trailing content on the header row, e.g. a summary pill. */
	actions?: Snippet;
	children: Snippet;
} = $props();
</script>

<ScrollArea class="h-full mr-2">
	<div class="flex min-h-full flex-col gap-6 p-6">
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold">{title}</h1>
				<p class="text-muted-foreground text-sm">{description}</p>
			</div>
			{@render actions?.()}
		</div>
		{@render children()}
	</div>
</ScrollArea>
