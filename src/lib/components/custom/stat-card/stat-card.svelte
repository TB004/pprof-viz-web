<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import type { Component } from "svelte";
import * as Card from "#lib/components/ui/card";

let {
	label,
	value,
	description,
	icon: Icon,
}: {
	label: string;
	value: string;
	description: string;
	icon: Component;
} = $props();
</script>

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
