<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import RadioCard from "#lib/components/radio-card.svelte";
import { CollectionType } from "#lib/types";

const modeOptions: Array<{
	value: CollectionType;
	title: string;
	description: string;
}> = [
	{
		value: CollectionType.Stream,
		title: "Stream",
		description: "Continuous samples at a fixed interval.",
	},
	{
		value: CollectionType.Snapshot,
		title: "Snapshot",
		description: "One capture of the current runtime state.",
	},
];

type Props = {
	value: CollectionType;
	onChange: (value: CollectionType) => void;
	label?: string;
};

let { value, onChange, label = "Collection mode" }: Props = $props();

const uid = $props.id();
</script>

<div>
	<span class="mb-2 block text-[13px] font-[550]">{label}</span>
	<div
		role="radiogroup"
		aria-label={label}
		class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5"
	>
		{#each modeOptions as option (option.value)}
			<RadioCard
				name="{uid}-mode"
				title={option.title}
				description={option.description}
				checked={value === option.value}
				onSelect={() => onChange(option.value)}
			/>
		{/each}
	</div>
</div>
