<script lang="ts">
import { CircleAlertIcon, LoaderCircle, PauseIcon } from "@lucide/svelte";
import {
	ErrorView,
	StatusElement,
} from "$lib/components/custom/session-status-bar";
import { CollectionService, ErrorService } from "$lib/services";
import { CollectionType } from "$lib/services/profile_service";
import { cn } from "$lib/utils.js";

let showErrors = $state(false);

const collectionState = CollectionService.collectionState;
const errorState = ErrorService.errorState;

const modeLabel = $derived(
	$collectionState.mode === CollectionType.Snapshot
		? "Snapshot"
		: $collectionState.mode === CollectionType.Stream
			? "Stream"
			: undefined,
);

const urlLabel = $derived($collectionState.url?.toString() ?? undefined);

const statusLabel = $derived(
	$collectionState.status === CollectionService.CollectionStatus.Running
		? "Running"
		: "Idle",
);

const statusIconClass = $derived(
	$collectionState.status === CollectionService.CollectionStatus.Running
		? "size-3.5 animate-spin text-foreground"
		: "size-3.5 text-muted-foreground",
);

const errorCount = $derived($errorState.length);
</script>

<footer
	class="border-sidebar-border/70 bg-sidebar/90 text-sidebar-foreground supports-backdrop-filter:bg-sidebar/80 shrink-0 border-t backdrop-blur"
>
	<div
		class="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-xs"
	>
		<StatusElement>
			{#if $collectionState.status === CollectionService.CollectionStatus.Running}
				<LoaderCircle class={statusIconClass} />
			{:else}
				<PauseIcon class={statusIconClass} />
			{/if}
			<span class="font-medium">{statusLabel}</span>
		</StatusElement>

		<StatusElement>
			<span class="text-muted-foreground">URL</span>
			{#if urlLabel}
				<span class="truncate font-medium">{urlLabel}</span>
			{:else}
				<span class="font-medium text-muted-foreground">undefined</span>
			{/if}
		</StatusElement>

		<StatusElement>
			<span class="text-muted-foreground">Mode</span>
			{#if modeLabel}
				<span class="font-medium">{modeLabel}</span>
			{:else}
				<span class="font-medium text-muted-foreground">undefined</span>
			{/if}
		</StatusElement>

		<StatusElement>
			<span class="text-muted-foreground">Samples</span>
			<span class="font-medium">{$collectionState.collectedSamples}</span>
		</StatusElement>

		<StatusElement>
			<span class="text-muted-foreground">Time</span>
			<span class="font-medium"
				>{CollectionService.formatElapsedTime($collectionState.elapsedSeconds)}</span
			>
		</StatusElement>

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
			<CircleAlertIcon
				class={cn("size-3.5", errorCount > 0 ? "text-red-500" : "text-muted-foreground")}
			/>
		</button>
	</div>
</footer>

{#if showErrors}
	<ErrorView bind:showErrors {errorState} />
{/if}
