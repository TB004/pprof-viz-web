<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts" generics="T extends string | number">
import { cn } from "#lib/utils";

let {
	options,
	value = $bindable(),
	label,
	class: className,
}: {
	options: { value: T; label: string }[];
	value: T;
	/** Names the group for assistive technology. */
	label: string;
	class?: string;
} = $props();
</script>

<fieldset
	class={cn(
		"border-line bg-hover m-0 inline-flex shrink-0 gap-0.5 rounded-control border p-[3px]",
		className,
	)}
>
	<legend class="sr-only">{label}</legend>
	{#each options as option (option.value)}
		<button
			type="button"
			aria-pressed={value === option.value}
			class="text-muted-foreground hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink h-7 min-w-10 cursor-pointer rounded-[7px] px-2.5 text-[12.5px] font-medium whitespace-nowrap aria-pressed:shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
			onclick={() => (value = option.value)}
		>
			{option.label}
		</button>
	{/each}
</fieldset>
