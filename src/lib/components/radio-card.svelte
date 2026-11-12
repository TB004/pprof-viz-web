<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { cn } from "#lib/utils";

let {
	name,
	title,
	description,
	checked,
	onSelect,
	class: className,
}: {
	/** Shared by the cards of one group, so the arrow keys move between them. */
	name: string;
	title: string;
	description: string;
	checked: boolean;
	onSelect: () => void;
	class?: string;
} = $props();
</script>

<label
	class={cn(
		"group/radio border-line-2 bg-surface text-ink hover:border-faint has-checked:border-acc has-checked:bg-acc-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus) flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left",
		className,
	)}
>
	<input type="radio" class="sr-only" {name} {checked} onchange={onSelect}>
	<span
		class="border-line-2 bg-field group-has-checked/radio:border-acc mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]"
	>
		{#if checked}
			<span class="bg-acc size-2 rounded-full"></span>
		{/if}
	</span>
	<span>
		<span class="block text-[13.5px] font-semibold">{title}</span>
		<span class="text-muted-foreground mt-0.5 block text-[12.5px]">
			{description}
		</span>
	</span>
</label>
