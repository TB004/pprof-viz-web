<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	CircleDotIcon,
	PauseIcon,
	PlayIcon,
} from "@lucide/svelte";
import { collectionService } from "#lib/app.svelte.js";
import { Button } from "#lib/components/ui/button";
import * as Select from "#lib/components/ui/select/index.js";
import { CollectionStatus } from "#lib/types";

let {
	totalRows,
	paused = $bindable(),
	currentPage = $bindable(1),
	rowsPerPage = $bindable(25),
}: {
	totalRows: number;
	paused: boolean;
	currentPage: number;
	rowsPerPage: number;
} = $props();

const collectionState = collectionService.getState();

const ROWS_OPTIONS = [25, 50, 100, 200] as const;

let rowsPerPageStr = $state(String(rowsPerPage));

const isRunning = $derived(collectionState.status === CollectionStatus.Running);
const sampleCount = $derived(collectionState.data?.length ?? 0);
const totalPages = $derived(Math.max(1, Math.ceil(totalRows / rowsPerPage)));
const effectivePage = $derived(Math.min(currentPage, totalPages));

// Reset to page 1 when the live view resumes.
$effect(() => {
	if (!paused) {
		currentPage = 1;
	}
});

function prevPage() {
	if (effectivePage > 1) currentPage = effectivePage - 1;
}

function nextPage() {
	if (effectivePage < totalPages) currentPage = effectivePage + 1;
}

function pauseLive() {
	paused = true;
}

function resume() {
	paused = false;
}

function handleRowsChange(v: string) {
	rowsPerPageStr = v;
	rowsPerPage = Number(v);
	currentPage = 1;
}
</script>

<div class="flex flex-wrap items-center justify-between gap-3">
	<!-- Left: idle / live / paused indicator -->
	<div class="flex items-center gap-2">
		{#if !isRunning}
			<div
				class="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground"
			>
				<CircleDotIcon class="size-3.5" />
				Idle
			</div>
			<Button type="button" disabled size="sm" variant="outline">
				<PauseIcon class="size-3" />
				Pause
			</Button>
		{:else if paused}
			<div
				class="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"
			>
				<PauseIcon class="size-3.5" />
				Live view paused
			</div>
			<Button type="button" size="sm" variant="outline" onclick={resume}>
				<PlayIcon class="size-3" />
				Resume
			</Button>
		{:else}
			<div
				class="flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400"
			>
				<CircleDotIcon class="size-3.5" />
				Live
			</div>
			<Button type="button" size="sm" variant="outline" onclick={pauseLive}>
				<PauseIcon class="size-3" />
				Pause
			</Button>
		{/if}
		<span class="text-xs text-muted-foreground">
			{sampleCount.toLocaleString()}
			sample{sampleCount === 1 ? "" : "s"}
		</span>
	</div>

	<!-- Right: rows per page + pagination -->
	<div class="flex items-center gap-3">
		<p class="text-muted-foreground/70 w-full text-xs font-medium">
			Rows per page
		</p>
		<Select.Root
			type="single"
			value={rowsPerPageStr}
			onValueChange={(v) => handleRowsChange(v ?? "25")}
		>
			<Select.Trigger class="w-full font-mono">
				<span class="truncate">{rowsPerPageStr}</span>
			</Select.Trigger>
			<Select.Content class="p-1.5">
				{#each ROWS_OPTIONS as opt}
					<Select.Item value={String(opt)} label={String(opt)} />
				{/each}
			</Select.Content>
		</Select.Root>

		<div class="flex items-center">
			<button
				type="button"
				class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
				disabled={effectivePage <= 1}
				onclick={prevPage}
			>
				<ChevronLeftIcon class="size-3.5" />
			</button>
			<span class="min-w-20 text-center text-xs text-muted-foreground">
				{effectivePage}
				/ {totalPages}
			</span>
			<button
				type="button"
				class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
				disabled={effectivePage >= totalPages}
				onclick={nextPage}
			>
				<ChevronRightIcon class="size-3.5" />
			</button>
		</div>
	</div>
</div>
