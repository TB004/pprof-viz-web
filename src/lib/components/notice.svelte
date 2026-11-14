<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon } from "@lucide/svelte";
import type { Component, Snippet } from "svelte";
import { cn } from "#lib/utils";

type Tone = "info" | "ok" | "warn" | "bad";

let {
	tone = "info",
	icon,
	class: className,
	children,
}: {
	tone?: Tone;
	/** Overrides the tone's default icon. */
	icon?: Component;
	class?: string;
	children: Snippet;
} = $props();

const toneIcon: Record<Tone, Component> = {
	info: InfoIcon,
	ok: CircleCheckIcon,
	warn: TriangleAlertIcon,
	bad: TriangleAlertIcon,
};

const Icon = $derived(icon ?? toneIcon[tone]);
</script>

<div
	class={cn(
		"flex items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-[12.5px]",
		tone === "info" && "border-line bg-surface-2 text-ink-2 border px-3.5 py-3",
		tone === "ok" && "bg-ok-soft text-ok",
		tone === "warn" && "bg-warn-soft text-warn",
		tone === "bad" && "bg-bad-soft text-bad",
		className,
	)}
>
	<Icon
		class={tone === "info" ? "size-4 shrink-0" : "mt-px size-3.5 shrink-0"}
	/>
	<div class="min-w-0">{@render children()}</div>
</div>
