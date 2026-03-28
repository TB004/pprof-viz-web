<script lang="ts">
import { LoaderCircle, PauseIcon } from "@lucide/svelte";
import * as Tooltip from "$lib/components/ui/tooltip/index.js";
import {
	CollectionType,
	collectionState,
	formatElapsedTime,
} from "$lib/services/collection_service.js";

const modeLabel = $derived(
	$collectionState.status === "running"
		? $collectionState.mode === CollectionType.Snapshot
			? "Snapshot"
			: $collectionState.mode === CollectionType.Stream
				? "Stream"
				: undefined
		: undefined,
);

const urlLabel = $derived(
	$collectionState.status === "running"
		? ($collectionState.url?.toString() ?? undefined)
		: undefined,
);

const statusLabel = $derived(
	$collectionState.status === "running" ? "Running" : "Idle",
);

const statusIconClass = $derived(
	$collectionState.status === "running"
		? "size-3.5 animate-spin text-foreground"
		: "size-3.5 text-muted-foreground",
);
</script>

<footer
	class="border-sidebar-border/70 bg-sidebar/90 text-sidebar-foreground supports-backdrop-filter:bg-sidebar/80 shrink-0 border-t backdrop-blur"
>
	<div class="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-xs">
		<div class="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 shadow-sm">
			{#if $collectionState.status === "running"}
				<LoaderCircle class={statusIconClass} />
			{:else}
				<PauseIcon class={statusIconClass} />
			{/if}
			<span class="font-medium">{statusLabel}</span>
		</div>

		<div class="flex min-w-0 items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 shadow-sm">
			<span class="text-muted-foreground">URL</span>
			{#if urlLabel}
				<span class="truncate font-medium">{urlLabel}</span>
			{:else}
				<span class="font-medium text-muted-foreground">undefined</span>
			{/if}
		</div>

		<div class="flex min-w-0 items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 shadow-sm">
			<span class="text-muted-foreground">Mode</span>
			{#if modeLabel}
				<span class="font-medium">{modeLabel}</span>
			{:else}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props }: { props?: Record<string, unknown> })}
							<span class="font-medium text-muted-foreground" {...props}>undefined</span>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="top">Select a collection profile first.</Tooltip.Content>
				</Tooltip.Root>
			{/if}
		</div>

		<div class="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 shadow-sm">
			<span class="text-muted-foreground">Samples</span>
			<span class="font-medium">{$collectionState.collectedSamples}</span>
		</div>

		<div class="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 shadow-sm">
			<span class="text-muted-foreground">Time</span>
			<span class="font-medium">{formatElapsedTime($collectionState.elapsedSeconds)}</span>
		</div>
	</div>
</footer>