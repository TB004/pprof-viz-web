<script lang="ts" module>
import type {
	HTMLAnchorAttributes,
	HTMLButtonAttributes,
} from "svelte/elements";
import { tv, type VariantProps } from "tailwind-variants";
import { cn, type WithElementRef } from "#lib/utils";

export const buttonVariants = tv({
	base: "rounded-control border border-transparent text-[13px] font-medium aria-invalid:border-destructive [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap transition-[background-color,border-color,color,filter] select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	variants: {
		variant: {
			default:
				"bg-primary text-primary-foreground hover:bg-brand-hover disabled:hover:bg-primary",
			outline:
				"border-line-2 bg-surface text-ink hover:bg-hover disabled:hover:bg-surface aria-expanded:bg-hover",
			secondary: "bg-hover text-ink hover:bg-sel",
			ghost:
				"bg-transparent text-ink-2 hover:bg-hover hover:text-ink aria-expanded:bg-hover",
			destructive: "bg-bad-soft text-bad hover:brightness-97",
			danger: "bg-bad text-white hover:brightness-108",
			success: "bg-ok-soft text-ok",
			link: "text-acc underline-offset-4 hover:underline",
		},
		size: {
			default: "h-[38px] px-3.5",
			xs: "h-7 gap-1.5 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
			sm: "h-8 gap-1.5 rounded-lg px-2.5 text-[12.5px] [&_svg:not([class*='size-'])]:size-3.5",
			lg: "h-10 px-4",
			icon: "size-[38px]",
			"icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
			"icon-sm": "size-8 rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
			"icon-lg": "size-10",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
	},
});

export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
	WithElementRef<HTMLAnchorAttributes> & {
		variant?: ButtonVariant;
		size?: ButtonSize;
	};
</script>

<script lang="ts">
let {
	class: className,
	variant = "default",
	size = "default",
	ref = $bindable(null),
	href = undefined,
	type = "button",
	disabled,
	children,
	...restProps
}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
