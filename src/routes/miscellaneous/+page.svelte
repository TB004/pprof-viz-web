<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { BracesIcon, LinkIcon, PackageIcon } from "@lucide/svelte";
import type { Component } from "svelte";
import { MetricChart } from "$lib/components/custom/charts";
import { EmptyState, PageShell } from "$lib/components/custom/page";
import { StatGrid } from "$lib/components/custom/stat-card";
import * as Card from "$lib/components/ui/card";
import { Tooltip } from "$lib/components/ui/chart";
import { fmtSecs, fmtSecsAxis } from "$lib/format";
import { CollectionService } from "$lib/services";

const collectionState = CollectionService.collectionState;

const GO_DEBUG_KEYS = [
	"cacheHashEvents",
	"cacheTestEvents",
	"cacheVerifyEvents",
	"http2ClientEvents",
	"http2ServerEvents",
	"tls10ServerEvents",
	"tls3DesEvents",
	"tlsMaxRsaSizeEvents",
	"tlsRsaKexEvents",
	"tlsSha1Events",
	"tlsUnsafeEkmEvents",
	"httpCookieMaxNumEvents",
	"httpLaxContentLengthEvents",
	"httpMuxGo121Events",
	"httpServeContentKeepHeadersEvents",
	"allowMultipleVcsEvents",
	"asyncTimerChanEvents",
	"containerMaxProcsEvents",
	"cryptoCustomRandEvents",
	"embedFollowSymlinkEvents",
	"execErrDotEvents",
	"testJsonBuildTextEvents",
	"typeAliasEvents",
	"htmlMetaContentUrlEscapedEvents",
	"installGoRootEvents",
	"multipartMaxHeadersEvents",
	"multipartMaxPartsEvents",
	"multipathTcpEvents",
	"netEdns0Events",
	"panicNilEvents",
	"randAutoSeedEvents",
	"randSeedNopEvents",
	"rsa1024MinEvents",
	"tarInsecurePathEvents",
	"updateMaxProcsEvents",
	"urlMaxQueryParamsEvents",
	"urlStrictColonsEvents",
	"winReadLinkVolumeEvents",
	"winSymlinkEvents",
	"x509KeypairLeafEvents",
	"x509NegativeSerialEvents",
	"x509RsaCrtEvents",
	"x509Sha256SkidEvents",
	"x509UseFallbackRootsEvents",
	"x509UsePoliciesEvents",
	"zipInsecurePathEvents",
] as const;

function fmtDebugKey(key: string): string {
	return key
		.replace(/Events$/, "")
		.replace(/([A-Z])/g, " $1")
		.replace(/(\d+)/g, " $1")
		.trim()
		.replace(/\s+/g, " ")
		.split(" ")
		.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
		.join(" ");
}

// Returns "" for fractional ticks so duplicate labels don't appear when the
// data range is small and d3 generates non-integer tick values.
function fmtIntAxis(n: number): string {
	if (n !== Math.floor(n)) return "";
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

const frames = $derived($collectionState.data ?? []);
const hasData = $derived(frames.length > 0);
const latest = $derived(frames.at(-1));

const totalCgoCalls = $derived(Number(latest?.cgo?.cgoCalls ?? 0));

const cgoChartData = $derived(
	frames.map((frame, i) => ({
		sample: i + 1,
		cgoCalls: Number(frame.cgo?.cgoCalls ?? 0),
	})),
);

const syncChartData = $derived(
	frames.map((frame, i) => ({
		sample: i + 1,
		mutexWait: frame.sync?.totalMutexWaitDurationSeconds ?? 0,
	})),
);

// Everything the GODEBUG chart and table need, from a single walk over the
// frame buffer.
const debugSummary = $derived.by(() => {
	const totals: { sample: number; total: number }[] = [];
	const counts = new Array<number>(GO_DEBUG_KEYS.length).fill(0);
	const lastActive = new Array<number>(GO_DEBUG_KEYS.length).fill(-1);

	frames.forEach((frame, sampleIndex) => {
		const events = frame.goDebug;
		let total = 0;
		GO_DEBUG_KEYS.forEach((key, k) => {
			const value = Number(events?.[key] ?? 0);
			// A counter that is already non-zero in the very first sample rose
			// before collection started, so attribute it to sample 1.
			if (sampleIndex === 0 ? value > 0 : value > counts[k]) {
				lastActive[k] = sampleIndex + 1;
			}
			counts[k] = value;
			total += value;
		});
		totals.push({ sample: sampleIndex + 1, total });
	});

	const rows = GO_DEBUG_KEYS.map((key, k) => ({
		key,
		label: fmtDebugKey(key),
		count: counts[k],
		lastActive: lastActive[k],
		// Active in the newest sample — needs two samples to be a comparison.
		activeInLast: frames.length >= 2 && lastActive[k] === frames.length,
	})).sort((a, b) => b.count - a.count);

	return { totals, rows, latestTotal: totals.at(-1)?.total ?? 0 };
});

const debugChartData = $derived(debugSummary.totals);
const debugTableRows = $derived(debugSummary.rows);

const summaryStats = $derived([
	{
		label: "Total CGo Calls",
		value: totalCgoCalls.toLocaleString(),
		description: "Cumulative C function calls from Go",
		Icon: LinkIcon as Component,
	},
	{
		label: "Total Debug Events",
		value: debugSummary.latestTotal.toLocaleString(),
		description: "Sum of all GODEBUG event counters",
		Icon: BracesIcon as Component,
	},
]);
</script>

<PageShell
	title="Miscellaneous"
	description="CGo calls, mutex contention, and Go debug event counters"
>
	{#if !hasData}
		<EmptyState icon={PackageIcon}>
			Select a profile and start collecting to see miscellaneous metrics.
		</EmptyState>
	{:else}
		<StatGrid stats={summaryStats} class="grid grid-cols-2 gap-4" />

		<MetricChart
			title="CGo Calls"
			description="Cumulative C function calls from Go over samples"
			type="line"
			data={cgoChartData}
			format={fmtIntAxis}
			series={[{ key: "cgoCalls", label: "CGo Calls" }]}
		/>

		<MetricChart
			title="Mutex Wait Duration"
			description="Total accumulated mutex contention time per sample"
			data={syncChartData}
			format={fmtSecsAxis}
			series={[
				{ key: "mutexWait", label: "Mutex Wait", color: "var(--chart-2)" },
			]}
			tooltip={mutexTooltip}
		/>

		<MetricChart
			title="Debug Events Over Time"
			description="Total GODEBUG event count accumulated across all event types per sample"
			type="line"
			data={debugChartData}
			format={fmtIntAxis}
			series={[
				{ key: "total", label: "Total Events", color: "var(--chart-3)" },
			]}
		/>

		<!-- Debug events table -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Debug Event Counters</Card.Title>
				<Card.Description>
					GODEBUG event types sorted by count — green dot indicates activity in
					the most recent sample
				</Card.Description>
			</Card.Header>
			<Card.Content class="p-0">
				<div class="overflow-hidden rounded-b-xl">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b bg-muted/50">
								<th
									class="px-4 py-3 text-left font-medium text-muted-foreground"
								>
									Event
								</th>
								<th
									class="px-4 py-3 text-right font-medium text-muted-foreground"
								>
									Count
								</th>
								<th
									class="px-4 py-3 text-right font-medium text-muted-foreground"
								>
									Last Active
								</th>
							</tr>
						</thead>
						<tbody>
							{#each debugTableRows as row (row.key)}
								<tr
									class="border-b last:border-0 transition-colors hover:bg-muted/30"
								>
									<td class="px-4 py-2.5">
										<div class="flex items-center gap-2">
											<span
												class="size-1.5 shrink-0 rounded-full {row.activeInLast
													? 'bg-green-500'
													: row.count > 0
														? 'bg-muted-foreground/40'
														: 'bg-muted'}"
											></span>
											<span
												class={row.count === 0 ? "text-muted-foreground" : ""}
											>
												{row.label}
											</span>
										</div>
									</td>
									<td
										class="px-4 py-2.5 text-right font-mono tabular-nums {row.count ===
										0
											? 'text-muted-foreground'
											: ''}"
									>
										{row.count.toLocaleString()}
									</td>
									<td class="px-4 py-2.5 text-right text-muted-foreground">
										{row.lastActive === -1 ? "—" : `Sample ${row.lastActive}`}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
</PageShell>

{#snippet mutexTooltip()}
	<Tooltip labelFormatter={(d) => `Sample ${d}`}>
		{#snippet formatter({ value, name })}
			<div class="flex w-full items-center gap-2">
				<div
					style="--color-bg: var(--chart-2); --color-border: var(--chart-2);"
					class="size-2.5 shrink-0 rounded-xs border-(--color-border) bg-(--color-bg)"
				></div>
				<div class="flex flex-1 items-center justify-between leading-none">
					<span class="text-muted-foreground">{name}</span>
					<span class="text-foreground font-mono font-medium tabular-nums">
						{fmtSecs(Number(value))}
					</span>
				</div>
			</div>
		{/snippet}
	</Tooltip>
{/snippet}
