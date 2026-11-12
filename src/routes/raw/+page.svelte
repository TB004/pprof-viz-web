<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	BracesIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CopyIcon,
	PauseIcon,
	PlayIcon,
} from "@lucide/svelte";
import { collectionService } from "#lib/app.svelte.js";
import EmptyState from "#lib/components/empty-state.svelte";
import ErrorAlert from "#lib/components/error-alert.svelte";
import PageShell from "#lib/components/page-shell.svelte";
import Panel from "#lib/components/panel.svelte";
import Segmented from "#lib/components/segmented.svelte";
import { Button } from "#lib/components/ui/button";
import { cpuSamples } from "#lib/session/metrics.js";
import { Task } from "#lib/task.svelte.js";
import { CollectionStatus, type Frame, type FrameGroup } from "#lib/types";
import {
	fmtBytes,
	fmtBytesAxis,
	fmtCount,
	fmtSecs,
	fmtTimeOfDay,
} from "#lib/utils";
import { groupPayload, jsonLines, toJson } from "./json.js";

type Row = { sample: number; frame: Frame; at: number | undefined };

const GROUPS: { group: FrameGroup; label: string }[] = [
	{ group: "cpu", label: "CPU" },
	{ group: "memory", label: "Memory" },
	{ group: "gc", label: "GC" },
	{ group: "scheduler", label: "Scheduler" },
	{ group: "goDebug", label: "GoDebug" },
	{ group: "cgo", label: "Cgo" },
	{ group: "sync", label: "Sync" },
];

const collectionState = collectionService.getState();

let paused = $state(false);
let frozen = $state<Row[] | null>(null);
let perPage = $state(25);
let pageNo = $state(1);
let selected = $state<number | null>(null);
let tab = $state<FrameGroup>("cpu");
let copied = $state(false);
const copying = new Task();

const isRunning = $derived(collectionState.status === CollectionStatus.Running);

// Newest first.
const liveRows = $derived(
	(collectionState.data ?? [])
		.map((frame, i) => ({
			sample: i + 1,
			frame,
			at: collectionState.dataTimestamps?.[i],
		}))
		.reverse(),
);
const rows = $derived(paused && frozen ? frozen : liveRows);

// Per-sample CPU for the summaries, indexed by sample number - 1.
const cpu = $derived(cpuSamples(collectionState.data ?? []));

const pages = $derived(Math.max(1, Math.ceil(rows.length / perPage)));
const page = $derived(Math.min(pageNo, pages));
const pageRows = $derived(rows.slice((page - 1) * perPage, page * perPage));

const current = $derived(
	rows.find((r) => r.sample === selected) ?? rows[0] ?? null,
);
const payload = $derived(
	current ? groupPayload(current.frame, tab, collectionState.metadata) : {},
);
const lines = $derived(jsonLines(payload));

// The live view follows the newest sample; a stopped session cannot be paused.
$effect(() => {
	if (!isRunning) paused = false;
});

$effect(() => {
	if (!paused) {
		frozen = null;
		pageNo = 1;
	}
});

function pause() {
	frozen = [...liveRows];
	paused = true;
}

function resume() {
	paused = false;
	selected = null;
}

function pick(row: Row) {
	if (isRunning && !paused) pause();
	selected = row.sample;
}

async function copy() {
	const ok = await copying.run(() =>
		navigator.clipboard.writeText(toJson(payload)),
	);
	if (!ok) return;
	copied = true;
	setTimeout(() => (copied = false), 1600);
}

function summary(row: Row) {
	const f = row.frame;
	const c = cpu[row.sample - 1];
	const debug = Object.entries(f.goDebug ?? {}).filter(
		([k, v]) => !k.startsWith("$") && Number(v ?? 0) > 0,
	).length;
	return [
		c ? `${fmtSecs(c.user)} usr · ${fmtSecs(c.gc)} gc` : "—",
		fmtBytes(Number(f.memory?.totalBytes ?? 0)),
		`${fmtCount(Number(f.gc?.totalCycles ?? 0))} cyc · ${fmtBytesAxis(Number(f.gc?.liveOccupiedBytes ?? 0))}`,
		`${fmtCount(f.scheduler?.liveGoroutines ?? 0)} g · ${f.scheduler?.runningGoroutines ?? 0} run`,
		`${debug} counter${debug === 1 ? "" : "s"}`,
		fmtCount(Number(f.cgo?.cgoCalls ?? 0)),
		fmtSecs(f.sync?.totalMutexWaitDurationSeconds ?? 0),
	];
}

const kindClass = {
	number: "text-(--json-number)",
	string: "text-(--json-string)",
	array: "text-(--json-array)",
	punct: "text-muted-foreground",
};
</script>

<PageShell
	title="Raw frames"
	description="Every merged AllResponse as received, newest first. Select a sample to inspect its JSON."
>
	<div class="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
		<span
			class="inline-flex h-8 items-center gap-2 rounded-full px-3 text-[12.5px] font-[550] {!isRunning
				? "bg-hover text-muted-foreground"
				: paused
					? "bg-warn-soft text-warn"
					: "bg-ok-soft text-ok"}"
		>
			<span class="size-[7px] rounded-full bg-current"></span>
			{!isRunning
				? rows.length
					? "Stopped"
					: "Idle"
				: paused
					? "Live view paused"
					: "Live"}
		</span>
		<Button
			variant="outline"
			size="sm"
			disabled={!isRunning}
			onclick={paused ? resume : pause}
		>
			{#if paused}
				<PlayIcon />
				Resume
			{:else}
				<PauseIcon />
				Pause
			{/if}
		</Button>
		<span class="text-muted-foreground text-[12.5px]">
			<span class="mono">{fmtCount(rows.length)}</span>
			frames
		</span>
		<span class="flex-1"></span>
		<span class="text-muted-foreground text-[12.5px]">Rows</span>
		<Segmented
			label="Rows per page"
			bind:value={
				() => perPage,
				(v) => {
	perPage = v;
	pageNo = 1;
}
			}
			options={[25, 50, 100].map((n) => ({ value: n, label: String(n) }))}
		/>
		<div class="flex items-center gap-1.5">
			<Button
				variant="outline"
				size="icon-sm"
				aria-label="Previous page"
				disabled={page <= 1}
				onclick={() => (pageNo = page - 1)}
			>
				<ChevronLeftIcon />
			</Button>
			<span class="mono text-muted-foreground min-w-24 text-center text-xs">
				{rows.length
					? `${(page - 1) * perPage + 1}–${Math.min(rows.length, page * perPage)} of ${rows.length}`
					: "0 of 0"}
			</span>
			<Button
				variant="outline"
				size="icon-sm"
				aria-label="Next page"
				disabled={page >= pages}
				onclick={() => (pageNo = page + 1)}
			>
				<ChevronRightIcon />
			</Button>
		</div>
	</div>

	{#if rows.length === 0}
		<EmptyState icon={BracesIcon} title="No frames yet">
			Select a profile and start collecting to see raw samples.
		</EmptyState>
	{:else}
		<div class="flex flex-wrap items-start gap-4">
			<Panel class="min-w-0 flex-[999_1_600px] overflow-hidden">
				<div class="overflow-x-auto">
					<div class="min-w-[1180px]">
						<div
							aria-hidden="true"
							class="bg-surface-2 text-muted-foreground grid min-h-[38px] grid-cols-[64px_76px_minmax(170px,1.6fr)_repeat(6,minmax(110px,1fr))] items-center gap-3 px-4 text-[11.5px] font-semibold tracking-[0.04em] uppercase"
						>
							<span>#</span>
							<span>Time</span>
							{#each GROUPS as g (g.group)}
								<span>{g.label}</span>
							{/each}
						</div>
						{#each pageRows as row (row.sample)}
							{@const on = row.sample === current?.sample}
							<button
								type="button"
								aria-pressed={on}
								class="border-line text-ink hover:bg-hover grid min-h-[42px] w-full cursor-pointer grid-cols-[64px_76px_minmax(170px,1.6fr)_repeat(6,minmax(110px,1fr))] items-center gap-3 border-t px-4 text-left text-[12.5px] {on
									? "bg-sel hover:bg-sel shadow-[inset_3px_0_0_var(--acc)]"
									: ""}"
								onclick={() => pick(row)}
							>
								<span class="mono font-semibold">#{row.sample}</span>
								<span class="mono text-muted-foreground">
									{row.at ? fmtTimeOfDay(row.at) : "—"}
								</span>
								{#each summary(row) as cell, i (i)}
									<span
										class="mono truncate {i === 4
											? "text-muted-foreground"
											: ""}"
									>
										{cell}
									</span>
								{/each}
							</button>
						{/each}
					</div>
				</div>
			</Panel>

			<Panel
				class="flex min-w-0 flex-[1_1_360px] flex-col"
				title="Sample #{current?.sample ?? "—"}"
				description={current?.at
					? `${fmtTimeOfDay(current.at)} · ${GROUPS.find((g) => g.group === tab)?.label}Response`
					: undefined}
			>
				{#snippet actions()}
					<Button variant="outline" size="sm" onclick={copy}>
						{#if copied}
							<CheckIcon />
							Copied
						{:else}
							<CopyIcon />
							Copy JSON
						{/if}
					</Button>
				{/snippet}
				<ErrorAlert
					class="mx-4 mb-2"
					message={copying.error}
					onDismiss={() => copying.reset()}
				/>
				<div
					role="tablist"
					aria-label="Response groups"
					class="border-line flex flex-wrap gap-1 border-b px-3.5 py-2.5"
				>
					{#each GROUPS as g (g.group)}
						<button
							type="button"
							role="tab"
							aria-selected={tab === g.group}
							class="text-muted-foreground hover:bg-hover hover:text-ink aria-selected:bg-sel aria-selected:text-acc h-[30px] cursor-pointer rounded-[7px] px-2.5 text-xs aria-selected:font-semibold"
							onclick={() => (tab = g.group)}
						>
							{g.label}
						</button>
					{/each}
				</div>
				<div
					role="tabpanel"
					class="mono max-h-[520px] overflow-auto px-4 pt-3 pb-4 text-xs leading-[1.75] whitespace-pre"
				>
					{#each lines as line, i (i)}
						<div style:padding-left="{line.depth * 16}px">
							<span class="text-ink-2">{line.key}</span
							><span class={kindClass[line.kind]}>{line.value}</span>
						</div>
					{/each}
				</div>
			</Panel>
		</div>
	{/if}
</PageShell>
