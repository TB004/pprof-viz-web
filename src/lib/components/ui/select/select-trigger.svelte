<script lang="ts">
import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
import { Select as SelectPrimitive } from "bits-ui";
import { cn, type WithoutChild } from "#lib/utils";

let {
	ref = $bindable(null),
	class: className,
	children,
	size = "default",
	...restProps
}: WithoutChild<SelectPrimitive.TriggerProps> & {
	size?: "sm" | "default";
} = $props();
</script>

<SelectPrimitive.Trigger
	bind:ref
	data-slot="select-trigger"
	data-size={size}
	class={cn(
		"bg-field border-line-2 data-placeholder:text-faint aria-invalid:border-destructive gap-2 rounded-control border px-3 py-2 text-[13.5px] transition-[border-color] hover:border-faint data-[size=default]:h-[38px] data-[size=sm]:h-8 *:data-[slot=select-value]:gap-1.5 [&_svg:not([class*='size-'])]:size-4 flex w-fit items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
		className,
	)}
	{...restProps}
>
	{@render children?.()}
	<ChevronDownIcon class="text-muted-foreground size-4 pointer-events-none" />
</SelectPrimitive.Trigger>
