<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts" module>
import type { Component } from "svelte";

export type Stat = {
	label: string;
	value: string;
	description: string;
	Icon: Component;
};
</script>

<script lang="ts">
import * as Card from "#lib/components/ui/card";

let {
	stats,
	class: className = "grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6",
}: {
	stats: Stat[];
	class?: string;
} = $props();
</script>

<div class={className}>
	{#each stats as { label, value, description, Icon } (label)}
		<Card.Root>
			<Card.Content class="p-4">
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground text-xs font-medium">{label}</span>
					<Icon class="text-muted-foreground size-3.5" />
				</div>
				<div class="mt-2">
					<span class="font-mono text-xl font-semibold tabular-nums">
						{value}
					</span>
				</div>
				<p class="text-muted-foreground mt-1 text-xs">{description}</p>
			</Card.Content>
		</Card.Root>
	{/each}
</div>
