<script lang="ts">
import { BracesIcon, LinkIcon, PackageIcon } from "@lucide/svelte";
import { AreaChart, LineChart } from "layerchart";
import type { Component } from "svelte";
import { StatCard } from "$lib/components/custom/stat-card";
import * as Card from "$lib/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	Tooltip,
} from "$lib/components/ui/chart";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
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

const totalDebugEvents = $derived(
	GO_DEBUG_KEYS.reduce(
		(sum, key) => sum + Number(latest?.goDebug?.[key] ?? 0),
		0,
	),
);

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

const debugChartData = $derived(
	frames.map((frame, i) => ({
		sample: i + 1,
		total: GO_DEBUG_KEYS.reduce(
			(sum, key) => sum + Number(frame.goDebug?.[key] ?? 0),
			0,
		),
	})),
);

const debugTableRows = $derived(
	GO_DEBUG_KEYS.map((key) => {
		const count = Number(latest?.goDebug?.[key] ?? 0);

		let lastActive = -1;
		for (let i = frames.length - 1; i >= 1; i--) {
			const curr = Number(frames[i].goDebug?.[key] ?? 0);
			const prev = Number(frames[i - 1].goDebug?.[key] ?? 0);
			if (curr > prev) {
				lastActive = i + 1;
				break;
			}
		}
		if (lastActive === -1 && count > 0) lastActive = 1;

		const activeInLast =
			frames.length >= 2 &&
			Number(frames.at(-1)?.goDebug?.[key] ?? 0) >
				Number(frames.at(-2)?.goDebug?.[key] ?? 0);

		return {
			key,
			label: fmtDebugKey(key),
			count,
			lastActive,
			activeInLast,
		};
	}).sort((a, b) => b.count - a.count),
);

const summaryStats = $derived([
	{
		label: "Total CGo Calls",
		value: totalCgoCalls.toLocaleString(),
		description: "Cumulative C function calls from Go",
		Icon: LinkIcon as Component,
	},
	{
		label: "Total Debug Events",
		value: totalDebugEvents.toLocaleString(),
		description: "Sum of all GODEBUG event counters",
		Icon: BracesIcon as Component,
	},
]);

const cgoChartConfig = {
	cgoCalls: { label: "CGo Calls", color: "var(--chart-1)" },
} satisfies ChartConfig;

const syncChartConfig = {
	mutexWait: { label: "Mutex Wait", color: "var(--chart-2)" },
} satisfies ChartConfig;

const debugTotalChartConfig = {
	total: { label: "Total Events", color: "var(--chart-3)" },
} satisfies ChartConfig;
</script>

<ScrollArea class="h-full mr-2">
	<div class="flex min-h-full flex-col gap-6 p-6">
		<div>
			<h1 class="text-2xl font-semibold">Miscellaneous</h1>
			<p class="text-muted-foreground text-sm">
				CGo calls, mutex contention, and Go debug event counters
			</p>
		</div>

		{#if !hasData}
			<div class="flex flex-1 items-center justify-center">
				<Card.Root class="w-fit border-dashed">
					<Card.Content
						class="flex flex-col items-center gap-3 px-16 py-12 text-center"
					>
						<div
							class="bg-muted flex h-12 w-12 items-center justify-center rounded-full"
						>
							<PackageIcon class="text-muted-foreground size-6" />
						</div>
						<div>
							<p class="font-medium">No data yet</p>
							<p class="text-muted-foreground text-sm">
								Select a profile and start collecting to see miscellaneous
								metrics.
							</p>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		{:else}
			<!-- Summary cards -->
			<div class="grid grid-cols-2 gap-4">
				{#each summaryStats as { label, value, description, Icon } (label)}
					<StatCard {label} {value} {description} icon={Icon} />
				{/each}
			</div>

			<!-- CGo chart -->
			<Card.Root>
				<Card.Header>
					<Card.Title>CGo Calls</Card.Title>
					<Card.Description>
						Cumulative C function calls from Go over samples
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<ChartContainer config={cgoChartConfig} class="aspect-auto h-52">
						<LineChart
							data={cgoChartData}
							x="sample"
							yNice
							props={{ yAxis: { format: fmtIntAxis } }}
							series={[
                                {
                                    key: "cgoCalls",
                                    label: "CGo Calls",
                                    color: "var(--color-cgoCalls)",
                                },
                            ]}
						>
							{#snippet tooltip()}
								<Tooltip labelFormatter={(d) => `Sample ${d}`} />
							{/snippet}
						</LineChart>
					</ChartContainer>
				</Card.Content>
			</Card.Root>

			<!-- Sync chart -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Mutex Wait Duration</Card.Title>
					<Card.Description>
						Total accumulated mutex contention time per sample
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<ChartContainer config={syncChartConfig} class="aspect-auto h-52">
						<AreaChart
							data={syncChartData}
							x="sample"
							yNice
							props={{ yAxis: { format: fmtSecsAxis } }}
							series={[
                                {
                                    key: "mutexWait",
                                    label: "Mutex Wait",
                                    color: "var(--color-mutexWait)",
                                },
                            ]}
						>
							{#snippet tooltip()}
								<Tooltip labelFormatter={(d) => `Sample ${d}`}>
									{#snippet formatter({ value, name })}
										<div class="flex w-full items-center gap-2">
											<div
												style="--color-bg: var(--chart-2); --color-border: var(--chart-2);"
												class="size-2.5 shrink-0 rounded-xs border-(--color-border) bg-(--color-bg)"
											></div>
											<div
												class="flex flex-1 items-center justify-between leading-none"
											>
												<span class="text-muted-foreground">{name}</span>
												<span
													class="text-foreground font-mono font-medium tabular-nums"
												>
													{fmtSecs(Number(value))}
												</span>
											</div>
										</div>
									{/snippet}
								</Tooltip>
							{/snippet}
						</AreaChart>
					</ChartContainer>
				</Card.Content>
			</Card.Root>

			<!-- Debug events over time chart -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Debug Events Over Time</Card.Title>
					<Card.Description>
						Total GODEBUG event count accumulated across all event types per
						sample
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<ChartContainer
						config={debugTotalChartConfig}
						class="aspect-auto h-52"
					>
						<LineChart
							data={debugChartData}
							x="sample"
							yNice
							props={{ yAxis: { format: fmtIntAxis } }}
							series={[
                                {
                                    key: "total",
                                    label: "Total Events",
                                    color: "var(--color-total)",
                                },
                            ]}
						>
							{#snippet tooltip()}
								<Tooltip labelFormatter={(d) => `Sample ${d}`} />
							{/snippet}
						</LineChart>
					</ChartContainer>
				</Card.Content>
			</Card.Root>

			<!-- Debug events table -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Debug Event Counters</Card.Title>
					<Card.Description>
						GODEBUG event types sorted by count — green dot indicates activity
						in the most recent sample
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
													class={row.count === 0
                                                        ? "text-muted-foreground"
                                                        : ""}
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
											{row.lastActive === -1
                                                ? "—"
                                                : `Sample ${row.lastActive}`}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
</ScrollArea>
