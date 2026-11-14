<script lang="ts">
import { Dialog as DialogPrimitive } from "bits-ui";
import type { HTMLAttributes } from "svelte/elements";
import { Button } from "#lib/components/ui/button/index.js";
import { cn, type WithElementRef } from "#lib/utils";

let {
	ref = $bindable(null),
	class: className,
	children,
	showCloseButton = false,
	...restProps
}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	showCloseButton?: boolean;
} = $props();
</script>

<div
	bind:this={ref}
	data-slot="dialog-footer"
	class={cn(
		"flex flex-wrap justify-end gap-2 px-[22px] pt-3.5 pb-5",
		className,
	)}
	{...restProps}
>
	{@render children?.()}
	{#if showCloseButton}
		<DialogPrimitive.Close>
			{#snippet child({ props })}
				<Button variant="outline" {...props}>Close</Button>
			{/snippet}
		</DialogPrimitive.Close>
	{/if}
</div>
