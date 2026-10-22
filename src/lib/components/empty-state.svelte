<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import type { Component, Snippet } from "svelte";
import * as Card from "#lib/components/ui/card";

let {
	icon: Icon,
	title = "No data yet",
	children,
}: {
	icon: Component;
	title?: string;
	/** The explanatory line under the title. */
	children: Snippet;
} = $props();
</script>

<div class="flex flex-1 items-center justify-center">
	<Card.Root class="w-fit border-dashed">
		<Card.Content
			class="flex flex-col items-center gap-3 px-16 py-12 text-center"
		>
			<div
				class="bg-muted flex h-12 w-12 items-center justify-center rounded-full"
			>
				<Icon class="text-muted-foreground size-6" />
			</div>
			<div>
				<p class="font-medium">{title}</p>
				<p class="text-muted-foreground text-sm">{@render children()}</p>
			</div>
		</Card.Content>
	</Card.Root>
</div>
