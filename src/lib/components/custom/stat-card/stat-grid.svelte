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
import StatCard from "./stat-card.svelte";

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
		<StatCard {label} {value} {description} icon={Icon} />
	{/each}
</div>
