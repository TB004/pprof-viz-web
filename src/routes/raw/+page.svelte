<script lang="ts">
import { BracesIcon } from "@lucide/svelte";
import { RawTable } from "$lib/components/custom/raw";
import RawControlsBar from "$lib/components/custom/raw/raw-controls-bar.svelte";
import * as Card from "$lib/components/ui/card/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { CollectionService } from "$lib/services";

const collectionState = CollectionService.collectionState;

let paused = $state(false);
let currentPage = $state(1);
let rowsPerPage = $state(25);
let totalRows = $state(0);

const hasData = $derived(($collectionState.data?.length ?? 0) > 0);
</script>

<ScrollArea class="mr-2 h-full">
	<div class="flex min-h-full flex-col gap-6 p-6">
		<!-- Header -->
		<div>
			<h1 class="text-2xl font-semibold">Raw Data</h1>
			<p class="text-muted-foreground text-sm">
				All proto fields from every sample — newest first. Click a cell to
				expand and pause the live view.
			</p>
		</div>

		<RawControlsBar {totalRows} bind:paused bind:currentPage bind:rowsPerPage />

		{#if !hasData}
			<div class="flex flex-1 items-center justify-center">
				<Card.Root class="w-fit border-dashed">
					<Card.Content
						class="flex flex-col items-center gap-3 px-16 py-12 text-center"
					>
						<div
							class="bg-muted flex h-12 w-12 items-center justify-center rounded-full"
						>
							<BracesIcon class="text-muted-foreground size-6" />
						</div>
						<div>
							<p class="font-medium">No data yet</p>
							<p class="text-muted-foreground text-sm">
								Select a profile and start collecting to see raw samples.
							</p>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		{:else}
			<RawTable {currentPage} {rowsPerPage} bind:paused bind:totalRows />
		{/if}
	</div>
</ScrollArea>
