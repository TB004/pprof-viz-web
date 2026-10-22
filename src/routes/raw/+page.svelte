<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { BracesIcon } from "@lucide/svelte";
import { collectionService } from "#lib/app.svelte.js";
import EmptyState from "#lib/components/empty-state.svelte";
import PageShell from "#lib/components/page-shell.svelte";
import ControlsBar from "./controls-bar.svelte";
import RawTable from "./raw-table.svelte";

const collectionState = collectionService.getState();

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
	<ControlsBar {totalRows} bind:paused bind:currentPage bind:rowsPerPage />

	{#if !hasData}
		<EmptyState icon={BracesIcon}>
			Select a profile and start collecting to see raw samples.
		</EmptyState>
	{:else}
		<RawTable {currentPage} {rowsPerPage} bind:paused bind:totalRows />
	{/if}
</PageShell>
