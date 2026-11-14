<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import type { Snippet } from "svelte";
import { cn } from "#lib/utils";

let {
	accent = false,
	class: className,
	children,
}: {
	accent?: boolean;
	class?: string;
	children: Snippet;
} = $props();
</script>

<span
	class={cn(
		"inline-flex h-5 shrink-0 items-center rounded-full border px-[7px] text-[10.5px] font-semibold tracking-[0.04em] whitespace-nowrap uppercase",
		accent
			? "border-acc-line bg-acc-soft text-acc"
			: "border-line-2 text-muted-foreground",
		className,
	)}
>
	{@render children()}
</span>
