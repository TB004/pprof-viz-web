<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { TriangleAlertIcon, XIcon } from "@lucide/svelte";
import { cn } from "#lib/utils";

let {
	message,
	onDismiss,
	class: className,
}: {
	/** Nothing renders while this is empty. */
	message: string | null | undefined;
	/** Shows a close button when given. */
	onDismiss?: () => void;
	class?: string;
} = $props();
</script>

{#if message}
	<div
		role="alert"
		class={cn(
			"bg-bad-soft text-bad flex items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-[12.5px]",
			className,
		)}
	>
		<TriangleAlertIcon class="mt-px size-3.5 shrink-0" />
		<p class="min-w-0 flex-1 wrap-break-word">{message}</p>
		{#if onDismiss}
			<button
				type="button"
				class="-my-0.5 -mr-1 cursor-pointer rounded p-0.5 hover:bg-bad/10"
				onclick={onDismiss}
			>
				<XIcon class="size-3.5" />
				<span class="sr-only">Dismiss</span>
			</button>
		{/if}
	</div>
{/if}
