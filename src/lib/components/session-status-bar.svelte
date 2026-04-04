<script lang="ts">
import {
	CircleAlertIcon,
	LoaderCircle,
	PauseIcon,
	Trash2Icon,
	XIcon,
} from "@lucide/svelte";
import { fly } from "svelte/transition";
import { Button } from "$lib/components/ui/button/index.js";
import * as Tooltip from "$lib/components/ui/tooltip/index.js";
import * as CollectionService from "$lib/services/collection_service.js";
import * as ErrorService from "$lib/services/error_service.js";
import { CollectionType } from "$lib/services/profile_service";
import { cn } from "$lib/utils.js";

let showErrors = $state(false);

const collectionState = CollectionService.collectionState;
const errorState = ErrorService.errorState;

const modeLabel = $derived(
	$collectionState.status === CollectionService.CollectionStatus.Running
		? $collectionState.mode === CollectionType.Snapshot
			? "Snapshot"
			: $collectionState.mode === CollectionType.Stream
				? "Stream"
				: undefined
		: undefined,
);

const urlLabel = $derived(
	$collectionState.status === CollectionService.CollectionStatus.Running
		? ($collectionState.url?.toString() ?? undefined)
		: undefined,
);

const statusLabel = $derived(
	$collectionState.status === CollectionService.CollectionStatus.Running ? "Running" : "Idle",
);

const statusIconClass = $derived(
	$collectionState.status === CollectionService.CollectionStatus.Running
		? "size-3.5 animate-spin text-foreground"
		: "size-3.5 text-muted-foreground",
);

const errorCount = $derived($errorState.length);
const visibleErrors = $derived($errorState.slice(0, 4));
</script>

<footer
	class="border-sidebar-border/70 bg-sidebar/90 text-sidebar-foreground supports-backdrop-filter:bg-sidebar/80 shrink-0 border-t backdrop-blur"
>
	<div class="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-xs">
		<div class="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 shadow-sm">
			{#if $collectionState.status === CollectionService.CollectionStatus.Running}
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
			<span class="font-medium">{CollectionService.formatElapsedTime($collectionState.elapsedSeconds)}</span>
		</div>

		<button
			type="button"
			onclick={() => (showErrors = !showErrors)}
			class={cn(
				"ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition-all",
				errorCount > 0
					? "border-red-500/20 bg-red-500/10 text-red-600 hover:bg-red-500/15"
					: "border-border/60 bg-background/70 text-muted-foreground hover:bg-muted/80",
			)}
		>
			<span>Error</span>
			<span class="tabular-nums">{errorCount}</span>
			<CircleAlertIcon class={cn("size-3.5", errorCount > 0 ? "text-red-500" : "text-muted-foreground")} />
		</button>
	</div>
</footer>

{#if showErrors}
	<div
		class="fixed right-4 bottom-20 z-50 w-[min(24rem,calc(100vw-2rem))]"
		transition:fly={{ y: 12, duration: 160 }}
	>
		<div class="overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl">
			<div class="flex items-center justify-between border-b border-border/60 px-4 py-3">
				<div>
					<p class="text-sm font-semibold text-foreground">Errors</p>
					<p class="text-xs text-muted-foreground">Persistent messages from the collection system</p>
				</div>
				<Button variant="ghost" size="icon-sm" onclick={() => (showErrors = false)}>
					<XIcon class="size-3.5" />
				</Button>
			</div>

			<div class="max-h-72 overflow-auto p-3">
				{#if visibleErrors.length > 0}
					<div class="space-y-2">
						{#each visibleErrors as error (error.id)}
							<div
								class="rounded-xl border border-border/60 bg-muted/35 p-3"
								transition:fly={{ x: 16, duration: 140 }}
							>
								<div class="flex items-center gap-3">
									<CircleAlertIcon class="size-4 shrink-0 self-center text-red-500" />
									<div class="min-w-0 flex-1">
										<p class="text-sm font-medium text-foreground">{error.message}</p>
										<p class="mt-1 text-xs text-muted-foreground">{ErrorService.formatErrorTimestamp(error.timestamp)}</p>
									</div>
									<Button
										variant="ghost"
										size="icon-sm"
										class="self-center text-red-500 hover:bg-red-500/10 hover:text-red-600"
										onclick={() => ErrorService.removeError(error.id)}
									>
										<Trash2Icon class="size-3.5" />
									</Button>
								</div>
							</div>
						{/each}
					</div>
					{#if $errorState.length > visibleErrors.length}
						<p class="mt-3 px-1 text-xs text-muted-foreground">
							Showing {visibleErrors.length} of {$errorState.length} errors.
						</p>
					{/if}
				{:else}
					<div class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 px-4 py-8 text-center">
						<CircleAlertIcon class="size-5 text-muted-foreground" />
						<p class="text-sm font-medium text-foreground">No errors registered</p>
						<p class="text-xs text-muted-foreground">The collection system has not reported any errors yet.</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}