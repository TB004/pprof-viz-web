<script lang="ts">
import type {
	HTMLInputAttributes,
	HTMLInputTypeAttribute,
} from "svelte/elements";
import { cn, type WithElementRef } from "#lib/utils";

type InputType = Exclude<HTMLInputTypeAttribute, "file">;

type Props = WithElementRef<
	Omit<HTMLInputAttributes, "type"> &
		(
			| { type: "file"; files?: FileList }
			| { type?: InputType; files?: undefined }
		)
>;

let {
	ref = $bindable(null),
	value = $bindable(),
	type,
	files = $bindable(),
	class: className,
	"data-slot": dataSlot = "input",
	...restProps
}: Props = $props();
</script>

{#if type === "file"}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			"bg-field border-line-2 text-ink placeholder:text-faint aria-invalid:border-destructive h-[38px] w-full min-w-0 rounded-control border px-3 text-[13.5px] transition-[border-color,outline-color] outline-none focus-visible:border-transparent focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-(--focus) file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
			className,
		)}
		type="file"
		bind:files
		bind:value
		{...restProps}
	>
{:else}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			"bg-field border-line-2 text-ink placeholder:text-faint aria-invalid:border-destructive h-[38px] w-full min-w-0 rounded-control border px-3 text-[13.5px] transition-[border-color,outline-color] outline-none focus-visible:border-transparent focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-(--focus) file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
			className,
		)}
		{type}
		bind:value
		{...restProps}
	>
{/if}
