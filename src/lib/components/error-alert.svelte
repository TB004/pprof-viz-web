<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { CircleAlertIcon, XIcon } from "@lucide/svelte";
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
			"flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive",
			className,
		)}
	>
		<CircleAlertIcon class="mt-0.5 size-4 shrink-0" />
		<p class="min-w-0 flex-1 wrap-break-word">{message}</p>
		{#if onDismiss}
			<button
				type="button"
				class="-mr-1 rounded p-0.5 transition-colors hover:bg-destructive/15"
				onclick={onDismiss}
			>
				<XIcon class="size-3.5" />
				<span class="sr-only">Dismiss</span>
			</button>
		{/if}
	</div>
{/if}
