<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	ArrowRightIcon,
	CheckIcon,
	CpuIcon,
	FileIcon,
	GlobeIcon,
	HistoryIcon,
	LayersIcon,
	LockIcon,
	PlusIcon,
	RefreshCcwIcon,
	TriangleAlertIcon,
} from "@lucide/svelte";
import type { Component } from "svelte";
import {
	archiveService,
	collectionService,
	profileService,
} from "#lib/app.svelte.js";
import Chip from "#lib/components/chip.svelte";
import ErrorAlert from "#lib/components/error-alert.svelte";
import Notice from "#lib/components/notice.svelte";
import PageShell from "#lib/components/page-shell.svelte";
import Panel from "#lib/components/panel.svelte";
import Sparkline from "#lib/components/sparkline.svelte";
import { Button } from "#lib/components/ui/button";
import * as Sidebar from "#lib/components/ui/sidebar/index.js";
import { openProfileManager } from "#lib/profiles/state.svelte.js";
import { chooser } from "#lib/session/chooser.svelte.js";
import { cpuSamples } from "#lib/session/metrics.js";
import { modeLabel, sessionStatus } from "#lib/session/status.js";
import StatusDot from "#lib/session/status-dot.svelte";
import { Task } from "#lib/task.svelte.js";
import type { CollectionRow } from "#lib/types";
import {
	fmtBytes,
	fmtClock,
	fmtCount,
	fmtDateTime,
	fmtPercent,
	fmtSecs,
} from "#lib/utils";
import { goto } from "$app/navigation";

const collectionState = collectionService.getState();
const archiveState = archiveService.getState();
const catalog = profileService.getCatalog();
const sidebar = Sidebar.useSidebar();

const profileOptions = $derived(profileService.profileOptions());
const frames = $derived(collectionState.data ?? []);
const hasData = $derived(frames.length > 0);
const status = $derived(sessionStatus(collectionState));

const profile = $derived(
	collectionState.selectedProfile
		? profileService.find(collectionState.selectedProfile)
		: undefined,
);
const project = $derived(
	catalog.projects.find((p) => p.id === profile?.projectId),
);

// --- onboarding ---

const activeStep = $derived(
	profileOptions.length === 0
		? 1
		: !collectionState.selectedProfile
			? 2
			: !hasData
				? 3
				: 0,
);

const steps = [
	{
		title: "Create a profile",
		description:
			"Add a project, then a profile with the collector’s URL and how to sample it.",
		cta: "Open profile manager",
		run: () => openProfileManager(),
	},
	{
		title: "Select a profile",
		description: "Choose which collector to read from in the Collection panel.",
		cta: "Choose a profile",
		run: () => {
			sidebar.setOpenMobile(true);
			chooser.open = true;
		},
	},
	{
		title: "Start collecting",
		description:
			"Stream live telemetry. Every dashboard updates as samples arrive.",
		cta: "Start collecting",
		run: () => collectionService.startCollection(),
	},
];

// --- overview ---

const overview = $derived.by(() => {
	const latest = frames.at(-1);
	if (!latest) return [];
	const recent = frames.slice(-40);
	const cpu = cpuSamples(recent);
	const now = cpu.at(-1);
	const live = Number(latest.gc?.liveOccupiedBytes ?? 0);
	const goal = Number(latest.gc?.goalHeapSizeBytes ?? 0);
	const sched = latest.scheduler;
	const cards: {
		label: string;
		icon: Component;
		url: string;
		value: string;
		sub: string;
		history: number[];
		color: string;
	}[] = [
		{
			label: "CPU utilisation",
			icon: CpuIcon,
			url: "/cpu",
			value: frames.length > 1 ? fmtPercent(now?.utilisation ?? 0) : "—",
			sub: `${fmtSecs(now?.user ?? 0)} user · ${fmtSecs(now?.gc ?? 0)} GC`,
			history: cpu.map((c) => c.utilisation),
			color: "var(--chart-1)",
		},
		{
			label: "Memory mapped",
			icon: LayersIcon,
			url: "/memory",
			value: fmtBytes(Number(latest.memory?.totalBytes ?? 0)),
			sub: `${fmtBytes(Number(latest.memory?.heapObjectBytes ?? 0))} live heap`,
			history: recent.map((f) => Number(f.memory?.totalBytes ?? 0)),
			color: "var(--chart-3)",
		},
		{
			label: "Goroutines",
			icon: HistoryIcon,
			url: "/scheduler",
			value: fmtCount(sched?.liveGoroutines ?? 0),
			sub: `${sched?.runningGoroutines ?? 0} running · ${sched?.runnableGoroutines ?? 0} runnable`,
			history: recent.map((f) => f.scheduler?.liveGoroutines ?? 0),
			color: "var(--chart-2)",
		},
		{
			label: "Heap vs goal",
			icon: RefreshCcwIcon,
			url: "/gc",
			value: goal ? `${Math.round((live / goal) * 100)}%` : "—",
			sub: `${fmtBytes(live)} of ${fmtBytes(goal)}`,
			history: recent.map((f) => Number(f.gc?.liveOccupiedBytes ?? 0)),
			color: "var(--chart-4)",
		},
	];
	return cards;
});

const session = $derived([
	[
		"Project",
		collectionState.loaded ? "From the archive" : (project?.name ?? "—"),
	],
	["Collector", collectionState.url?.toString() ?? "—"],
	[
		"Mode",
		modeLabel(
			collectionState.loaded ? undefined : profile,
			collectionState.mode,
		),
	],
	[
		"Started",
		collectionState.startedAt ? fmtDateTime(collectionState.startedAt) : "—",
	],
	["Elapsed", fmtClock(collectionState.elapsedSeconds)],
	[
		"Auth",
		collectionState.loaded ? "—" : profile?.token ? "Bearer token" : "None",
	],
]);

const recentCollections = $derived(archiveState.collections.slice(0, 3));
const opening = new Task();

async function open(row: CollectionRow) {
	const ok = await opening.run(() => archiveService.load(row.id));
	if (ok) await goto("/cpu");
}
</script>

{#if !hasData}
	<PageShell
		eyebrow="Welcome"
		title="Stream live telemetry from your Go services"
		description="Pprof-Viz talks straight to the pprof-viz-collector embedded in your service. Everything stays in this browser — profiles in IndexedDB, saved collections as .ppvz files."
	>
		<div class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
			{#each steps as step, i (step.title)}
				{@const n = i + 1}
				{@const done = activeStep === 0 || n < activeStep}
				{@const active = n === activeStep}
				<div
					class="border-line bg-surface relative flex flex-col gap-2.5 rounded-panel border p-[18px] {active
						? "border-acc-line shadow-[0_0_0_3px_var(--acc-soft)]"
						: done
							? ""
							: "opacity-60"}"
				>
					<div class="flex items-center gap-2.5">
						<span
							class="flex size-7 items-center justify-center rounded-full border-[1.5px] text-[12.5px] font-semibold {done
								? "bg-primary text-primary-foreground border-transparent"
								: active
									? "border-acc text-acc"
									: "border-line-2 text-muted-foreground"}"
						>
							{#if done}
								<CheckIcon class="size-3.5" />
							{:else}
								{n}
							{/if}
						</span>
						<span class="eyebrow">
							{done ? "Done" : active ? "Next step" : "Later"}
						</span>
					</div>
					<div
						class="text-[14.5px] font-semibold {done
							? "text-muted-foreground"
							: ""}"
					>
						{step.title}
					</div>
					<div class="text-muted-foreground text-[13px]">
						{step.description}
					</div>
					{#if active}
						<Button class="mt-1 self-start" onclick={step.run}>
							{step.cta}
						</Button>
					{/if}
				</div>
			{/each}
		</div>

		<div class="panel-grid">
			<Panel
				title="Your profiles"
				description="Pick the service you want to observe."
			>
				{#snippet actions()}
					<Button
						variant="outline"
						size="sm"
						onclick={() => openProfileManager()}
					>
						<PlusIcon />
						New profile
					</Button>
				{/snippet}
				<div
					role="radiogroup"
					aria-label="Profiles"
					class="mt-2.5 flex flex-col"
				>
					{#each profileOptions as option (option.value)}
						{@const checked = option.value === collectionState.selectedProfile}
						<label
							class="border-line hover:bg-hover has-checked:bg-sel has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-(--focus) flex w-full cursor-pointer items-center gap-3 border-t px-[18px] py-3 text-left text-[13px] last:rounded-b-panel"
						>
							<input
								type="radio"
								name="home-profile"
								class="sr-only"
								{checked}
								onchange={() => collectionService.selectProfile(option.value)}
							>
							<span
								class="flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] {checked
									? "border-acc"
									: "border-line-2 bg-field"}"
							>
								{#if checked}
									<span class="bg-acc size-2 rounded-full"></span>
								{/if}
							</span>
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="font-[550]">{option.label}</span>
								<span class="mono text-muted-foreground truncate text-[11.5px]">
									{option.url.toString()}
								</span>
							</span>
							<span class="text-muted-foreground text-xs max-sm:hidden">
								{option.projectName}
							</span>
							<Chip>{option.mode}</Chip>
						</label>
					{:else}
						<p
							class="border-line text-muted-foreground border-t px-[18px] py-[22px] text-[13px]"
						>
							No profiles yet — create a project and a profile in the profile
							manager.
						</p>
					{/each}
				</div>
			</Panel>

			<Panel
				title="Before you connect"
				description="The browser talks to the collector directly, so browser rules apply."
			>
				<div class="flex flex-col gap-3 px-[18px] pt-2 pb-[18px]">
					<Notice icon={GlobeIcon}>
						<b>CORS</b>
						— allow this origin plus the
						<span class="mono">content-type</span>,
						<span class="mono">connect-protocol-version</span>
						and
						<span class="mono">authorization</span>
						headers.
					</Notice>
					<Notice icon={LockIcon}>
						<b>TLS</b>
						— certificates must already be trusted by the browser.
					</Notice>
					<Notice icon={TriangleAlertIcon}>
						<b>Mixed content</b>
						— an HTTPS-hosted dashboard cannot reach an
						<span class="mono">http://</span>
						collector.
					</Notice>
				</div>
			</Panel>
		</div>
	</PageShell>
{:else}
	<PageShell
		eyebrow="Overview"
		title={collectionState.loaded
			? (collectionState.loadedName ?? "Archived collection")
			: (collectionState.selectedProfileLabel ?? "Current session")}
	>
		{#snippet description()}
			<span class="mono"
				>{collectionState.url?.toString() ?? "no collector"}</span
			>
			·
			{modeLabel(
				collectionState.loaded ? undefined : profile,
				collectionState.mode,
			)}
		{/snippet}
		{#snippet actions()}
			<div
				class="border-line bg-surface inline-flex h-8 items-center gap-[7px] rounded-full border px-3 text-[12.5px] font-medium"
			>
				<StatusDot tone={status.tone} />
				{status.label}
				·
				<span class="mono">{fmtCount(collectionState.collectedSamples)}</span>
				samples
			</div>
		{/snippet}

		<div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
			{#each overview as card (card.url)}
				<a
					href={card.url}
					class="border-line bg-surface text-ink shadow-panel hover:border-acc-line flex flex-col gap-1 overflow-hidden rounded-panel border px-4 pt-4 transition-[border-color,translate] hover:-translate-y-px"
				>
					<span
						class="text-muted-foreground flex items-center gap-2 text-[12.5px] font-medium"
					>
						<card.icon class="size-4" />
						{card.label}
						<ArrowRightIcon class="text-faint ml-auto size-4" />
					</span>
					<span class="mono text-[28px] font-[550] tracking-[-0.02em]">
						{card.value}
					</span>
					<span class="text-muted-foreground text-xs">{card.sub}</span>
					<Sparkline
						values={card.history}
						color={card.color}
						height={40}
						fill
						class="-mx-4 mt-2.5 block h-16 w-[calc(100%+32px)]"
					/>
				</a>
			{/each}
		</div>

		<div class="panel-grid">
			<Panel
				title="Session"
				description="The collector this dashboard is reading from."
			>
				<dl
					class="m-0 grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-3 px-[18px] pt-3.5 pb-5 text-[13px]"
				>
					{#each session as [term, detail] (term)}
						<dt class="text-muted-foreground">{term}</dt>
						<dd
							class="m-0 min-w-0 truncate {[
								"Collector",
								"Started",
								"Elapsed",
							].includes(term)
								? "mono"
								: ""}"
						>
							{detail}
						</dd>
					{/each}
				</dl>
			</Panel>

			<Panel title="Recent collections" description="Saved in this browser.">
				{#snippet actions()}
					<Button variant="outline" size="sm" href="/archive"
						>Open archive</Button
					>
				{/snippet}
				<ErrorAlert
					class="mx-[18px] mt-2"
					message={opening.error}
					onDismiss={() => opening.reset()}
				/>
				<div class="mt-2.5 flex flex-col">
					{#each recentCollections as row (row.id)}
						<div
							class="border-line flex items-center gap-3 border-t px-[18px] py-3 text-[13px]"
						>
							<FileIcon class="text-muted-foreground size-4 shrink-0" />
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="truncate font-[550]">{row.name}</span>
								<span class="text-muted-foreground truncate text-xs">
									{row.profileName ?? "Unknown profile"}
									· {fmtClock(row.durationMs / 1000)} ·
									{fmtBytes(row.sizeBytes)}
								</span>
							</span>
							<Button
								variant="outline"
								size="sm"
								disabled={opening.pending}
								onclick={() => open(row)}
							>
								Open
							</Button>
						</div>
					{:else}
						<p
							class="border-line text-muted-foreground border-t px-[18px] py-5 text-[13px]"
						>
							Nothing saved yet. Use “Save collection” in the top bar.
						</p>
					{/each}
				</div>
			</Panel>
		</div>
	</PageShell>
{/if}
