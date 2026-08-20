<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { BracesIcon } from "@lucide/svelte";
import { EmptyState, PageShell } from "$lib/components/custom/page";
import { RawControlsBar, RawTable } from "$lib/components/custom/raw";
import { CollectionService } from "$lib/services";

const collectionState = CollectionService.collectionState;

let paused = $state(false);
let currentPage = $state(1);
let rowsPerPage = $state(25);
let totalRows = $state(0);

const hasData = $derived((collectionState.data?.length ?? 0) > 0);
</script>

<PageShell
	title="Raw Data"
	description="All proto fields from every sample — newest first. Click a cell to expand and pause the live view."
>
	<RawControlsBar {totalRows} bind:paused bind:currentPage bind:rowsPerPage />

	{#if !hasData}
		<EmptyState icon={BracesIcon}>
			Select a profile and start collecting to see raw samples.
		</EmptyState>
	{:else}
		<RawTable {currentPage} {rowsPerPage} bind:paused bind:totalRows />
	{/if}
</PageShell>
