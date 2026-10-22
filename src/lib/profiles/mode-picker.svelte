<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { CheckIcon } from "@lucide/svelte";
import { CollectionType } from "#lib/types";

const modeOptions: Array<{
	value: CollectionType;
	title: string;
	description: string;
}> = [
	{
		value: CollectionType.Snapshot,
		title: "Snapshot",
		description: "Capture a focused point-in-time profile.",
	},
	{
		value: CollectionType.Stream,
		title: "Stream",
		description: "Continuously follow runtime changes.",
	},
];

type Props = {
	value: CollectionType;
	onChange: (value: CollectionType) => void;
	label?: string;
};

let { value, onChange, label = "Mode" }: Props = $props();
</script>

<div>
	<p class="mb-3 text-sm font-medium text-foreground">{label}</p>
	<div class="grid gap-3 sm:grid-cols-2">
		{#each modeOptions as option (option.value)}
			{@const isSelected = value === option.value}
			<button
				type="button"
				class={`rounded-2xl border p-4 text-left transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border/70 bg-muted/25 hover:border-primary/30"}`}
				onclick={() => onChange(option.value)}
			>
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-base font-semibold text-foreground">
							{option.title}
						</p>
						<p class="mt-1 text-sm text-muted-foreground">
							{option.description}
						</p>
					</div>
					<div
						class={`flex h-5 w-6 items-center justify-center rounded-full border ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
					>
						{#if isSelected}
							<CheckIcon class="size-3.5" />
						{/if}
					</div>
				</div>
			</button>
		{/each}
	</div>
</div>
