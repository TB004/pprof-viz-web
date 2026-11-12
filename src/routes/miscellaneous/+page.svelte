<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { PackageIcon } from "@lucide/svelte";
import { collectionService } from "#lib/app.svelte.js";
import MetricChart, {
	type ChartRow,
} from "#lib/components/metric-chart.svelte";
import Panel from "#lib/components/panel.svelte";
import Segmented from "#lib/components/segmented.svelte";
import StatGrid from "#lib/components/stat-grid.svelte";
import {
	deltas,
	fmtCount,
	fmtCountAxis,
	fmtSecs,
	fmtSecsAxis,
} from "#lib/utils";
import DashboardShell from "../dashboard-shell.svelte";
import { windowed } from "../sample-window.svelte.js";

const collectionState = collectionService.getState();

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

/** The GODEBUG setting a counter belongs to, e.g. `http2client`. */
function settingName(key: string): string {
	return key.replace(/Events$/, "").toLowerCase();
}

const frames = $derived(collectionState.data ?? []);

let filter = $state<"nonzero" | "all">("nonzero");

// Everything the GODEBUG chart and table need, from a single walk over the
// frame buffer.
const debugSummary = $derived.by(() => {
	const totals: number[] = [];
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
		totals.push(total);
	});

	const rows = GO_DEBUG_KEYS.map((key, k) => ({
		key,
		name: settingName(key),
		count: counts[k],
		lastActive: lastActive[k],
		// Active in the newest sample — needs two samples to be a comparison.
		activeInLast: frames.length >= 2 && lastActive[k] === frames.length,
	})).sort((a, b) => b.count - a.count);

	return { totals, rows, hit: rows.filter((r) => r.count > 0).length };
});

const rows = $derived.by((): ChartRow[] => {
	const cgo = frames.map((f) => Number(f.cgo?.cgoCalls ?? 0));
	const cgoPer = deltas(cgo);
	const mutexPer = deltas(
		frames.map((f) => f.sync?.totalMutexWaitDurationSeconds ?? 0),
	);
	const debugPer = deltas(debugSummary.totals);
	return frames.map((_, i) => ({
		sample: i + 1,
		at: collectionState.dataTimestamps?.[i],
		cgo: cgo[i],
		cgoPer: cgoPer[i],
		mutex: mutexPer[i],
		debugTotal: debugSummary.totals[i],
		debugPer: debugPer[i],
	}));
});

const data = $derived(windowed(rows));
const history = (key: string) => rows.slice(-40).map((r) => r[key] ?? 0);

const stats = $derived.by(() => {
	const l = rows.at(-1) ?? { sample: 0 };
	return [
		{
			label: "CGo calls",
			value: fmtCount(l.cgo ?? 0),
			sub: "cumulative",
			history: history("cgo"),
			color: "var(--chart-1)",
		},
		{
			label: "CGo calls / sample",
			value: fmtCount(l.cgoPer ?? 0),
			history: history("cgoPer"),
			color: "var(--chart-1)",
		},
		{
			label: "Mutex wait",
			value: fmtSecs(l.mutex ?? 0),
			sub: "in the latest sample",
			history: history("mutex"),
			color: "var(--chart-2)",
		},
		{
			label: "GODEBUG events",
			value: fmtCount(l.debugTotal ?? 0),
			sub: "cumulative, all settings",
			history: history("debugTotal"),
			color: "var(--chart-3)",
		},
		{
			label: "Settings hit",
			value: `${debugSummary.hit} of ${GO_DEBUG_KEYS.length}`,
			sub: "non-default behaviours seen",
			history: history("debugPer"),
			color: "var(--chart-3)",
		},
	];
});

const tableRows = $derived(
	filter === "all"
		? debugSummary.rows
		: debugSummary.rows.filter((r) => r.count > 0),
);
</script>

<DashboardShell
	title="Miscellaneous"
	icon={PackageIcon}
	description="CGo calls, mutex contention and GODEBUG non-default behaviour counters."
>
	<StatGrid {stats} />

	<div class="panel-grid">
		<MetricChart
			title="CGo calls"
			description="C function calls made from Go, per sample."
			{data}
			fitMin
			format={fmtCount}
			axisFormat={fmtCountAxis}
			series={[{ key: "cgoPer", label: "Calls", color: "var(--chart-1)" }]}
		/>

		<MetricChart
			title="Mutex wait"
			description="Time goroutines spent blocked on sync.Mutex / RWMutex, per sample."
			{data}
			format={fmtSecs}
			axisFormat={fmtSecsAxis}
			series={[{ key: "mutex", label: "Wait", color: "var(--chart-2)" }]}
		/>

		<MetricChart
			class="col-span-full"
			title="GODEBUG events"
			description="New non-default-behaviour events per sample, across all settings."
			{data}
			format={fmtCount}
			axisFormat={fmtCountAxis}
			series={[{ key: "debugPer", label: "Events", color: "var(--chart-3)" }]}
		/>

		<Panel
			class="col-span-full overflow-hidden"
			title="GODEBUG event counters"
			description="Times the runtime fell back to a non-default behaviour. A green dot means the counter moved in the latest sample."
		>
			{#snippet actions()}
				<Segmented
					label="Filter counters"
					bind:value={filter}
					options={[
						{ value: "nonzero", label: `Non-zero · ${debugSummary.hit}` },
						{ value: "all", label: `All · ${GO_DEBUG_KEYS.length}` },
					]}
				/>
			{/snippet}
			<div class="mt-2 overflow-x-auto">
				{#if tableRows.length}
					<table
						aria-label="GODEBUG counters"
						class="w-full min-w-[560px] table-fixed border-collapse text-[13px]"
					>
						<thead
							class="bg-surface-2 text-muted-foreground text-[11.5px] tracking-[0.04em] uppercase"
						>
							<tr class="h-[38px]">
								<th scope="col" class="w-[42px] pl-[18px]">
									<span class="sr-only">Moved recently</span>
								</th>
								<th scope="col" class="px-1.5 text-left font-semibold">
									Setting
								</th>
								<th
									scope="col"
									class="w-[140px] px-1.5 text-right font-semibold"
								>
									Events
								</th>
								<th
									scope="col"
									class="w-[158px] pr-[18px] pl-1.5 text-right font-semibold"
								>
									Last active
								</th>
							</tr>
						</thead>
						<tbody>
							{#each tableRows as row (row.key)}
								<tr
									class="border-line hover:bg-hover h-11 border-t {row.count ===
									0
										? "text-muted-foreground"
										: ""}"
								>
									<td class="pl-[18px]">
										<span
											class="block size-[7px] rounded-full {row.activeInLast
												? "bg-ok"
												: row.count > 0
													? "bg-faint"
													: "bg-line-2"}"
										></span>
									</td>
									<td class="mono truncate px-1.5">{row.name}</td>
									<td class="mono px-1.5 text-right">{fmtCount(row.count)}</td>
									<td class="text-muted-foreground pr-[18px] pl-1.5 text-right">
										{row.lastActive === -1 ? "—" : `sample #${row.lastActive}`}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<p
						class="border-line text-muted-foreground border-t px-[18px] py-5 text-[13px]"
					>
						No GODEBUG counter has moved yet.
					</p>
				{/if}
			</div>
		</Panel>
	</div>
</DashboardShell>
