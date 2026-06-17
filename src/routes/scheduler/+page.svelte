<script lang="ts">
import {
	ActivityIcon,
	CpuIcon,
	GaugeIcon,
	HourglassIcon,
	LayersIcon,
	PlayIcon,
} from "@lucide/svelte";
import { LineChart, PieChart } from "layerchart";
import { HistogramChart } from "$lib/components/custom/histogram-chart";
import { StatCard } from "$lib/components/custom/stat-card";
import * as Card from "$lib/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	Tooltip,
} from "$lib/components/ui/chart";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { fmtSecsAxis } from "$lib/format";
import { CollectionService } from "$lib/services";

const collectionState = CollectionService.collectionState;

const frames = $derived($collectionState.data ?? []);
const metadata = $derived($collectionState.metadata);
const hasData = $derived(frames.length > 0);
const latest = $derived(frames.at(-1)?.scheduler);

const chartData = $derived(
	frames.map((frame, i) => ({
		sample: i + 1,
		running: frame.scheduler?.runningGoroutines ?? 0,
		runnable: frame.scheduler?.runnableGoroutines ?? 0,
		waiting: frame.scheduler?.waitingGoroutines ?? 0,
		live: frame.scheduler?.liveGoroutines ?? 0,
		threads: frame.scheduler?.totalLiveThreads ?? 0,
	})),
);

const composition = $derived([
	{
		key: "running",
		label: "Running",
		value: latest?.runningGoroutines ?? 0,
	},
	{
		key: "runnable",
		label: "Runnable",
		value: latest?.runnableGoroutines ?? 0,
	},
	{
		key: "waiting",
		label: "Waiting",
		value: latest?.waitingGoroutines ?? 0,
	},
	{
		key: "notInGo",
		label: "Not in Go",
		value: latest?.notInGoGoroutines ?? 0,
	},
]);

const stats = $derived([
	{
		label: "Live Goroutines",
		value: (latest?.liveGoroutines ?? 0).toLocaleString(),
		description: "Goroutines that currently exist",
		Icon: ActivityIcon,
	},
	{
		label: "Running",
		value: (latest?.runningGoroutines ?? 0).toLocaleString(),
		description: "Goroutines executing on a thread",
		Icon: PlayIcon,
	},
	{
		label: "Runnable",
		value: (latest?.runnableGoroutines ?? 0).toLocaleString(),
		description: "Ready goroutines awaiting a thread",
		Icon: GaugeIcon,
	},
	{
		label: "Waiting",
		value: (latest?.waitingGoroutines ?? 0).toLocaleString(),
		description: "Goroutines blocked or sleeping",
		Icon: HourglassIcon,
	},
	{
		label: "GOMAXPROCS",
		value: (latest?.gomaxprocsThreads ?? 0).toLocaleString(),
		description: "Threads allowed to run Go code",
		Icon: CpuIcon,
	},
	{
		label: "OS Threads",
		value: (latest?.totalLiveThreads ?? 0).toLocaleString(),
		description: "Total live OS threads",
		Icon: LayersIcon,
	},
]);

const compositionChartConfig = {
	running: { label: "Running", color: "var(--chart-1)" },
	runnable: { label: "Runnable", color: "var(--chart-2)" },
	waiting: { label: "Waiting", color: "var(--chart-3)" },
	notInGo: { label: "Not in Go", color: "var(--chart-4)" },
} satisfies ChartConfig;

const goroutineChartConfig = {
	running: { label: "Running", color: "var(--chart-1)" },
	runnable: { label: "Runnable", color: "var(--chart-2)" },
	waiting: { label: "Waiting", color: "var(--chart-3)" },
	threads: { label: "OS Threads", color: "var(--chart-4)" },
} satisfies ChartConfig;

// Histograms pair per-frame counts with bucket boundaries from metadata
// (boundaries are sent once, counts stream with each frame).
const schedMeta = $derived(metadata?.scheduler);
</script>

<ScrollArea class="h-full mr-2">
	<div class="flex min-h-full flex-col gap-6 p-6">
		<div>
			<h1 class="text-2xl font-semibold">Scheduler</h1>
			<p class="text-muted-foreground text-sm">
				Goroutine states, scheduling latency, and stop-the-world pauses
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
							<ActivityIcon class="text-muted-foreground size-6" />
						</div>
						<div>
							<p class="font-medium">No data yet</p>
							<p class="text-muted-foreground text-sm">
								Select a profile and start collecting to see scheduler metrics.
							</p>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
				{#each stats as { label, value, description, Icon } (label)}
					<StatCard {label} {value} {description} icon={Icon} />
				{/each}
			</div>

			<div class="grid gap-6 lg:grid-cols-[2fr_3fr]">
				<Card.Root>
					<Card.Header>
						<Card.Title>Goroutine States</Card.Title>
						<Card.Description>
							How goroutines are distributed right now
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<ChartContainer
							config={compositionChartConfig}
							class="mx-auto h-64 w-full"
						>
							<PieChart
								data={composition}
								key="key"
								value="value"
								label="label"
								innerRadius={0.6}
								outerRadius={0.78}
								cRange={[
                                    "var(--chart-1)",
                                    "var(--chart-2)",
                                    "var(--chart-3)",
                                    "var(--chart-4)",
                                ]}
								c="key"
								labels={{
                                    value: (d) => d.label,
                                    class: "fill-foreground text-xs font-medium",
                                }}
							>
								{#snippet tooltip()}
									<Tooltip hideLabel nameKey="label" />
								{/snippet}
							</PieChart>
						</ChartContainer>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title>Goroutines & Threads</Card.Title>
						<Card.Description>
							Running, runnable, waiting goroutines and OS threads over time
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<ChartContainer
							config={goroutineChartConfig}
							class="aspect-auto h-64"
						>
							<LineChart
								data={chartData}
								x="sample"
								yNice
								padding={{ left: 35 }}
								series={[
                                    {
                                        key: "running",
                                        label: "Running",
                                        color: "var(--color-running)",
                                    },
                                    {
                                        key: "runnable",
                                        label: "Runnable",
                                        color: "var(--color-runnable)",
                                    },
                                    {
                                        key: "waiting",
                                        label: "Waiting",
                                        color: "var(--color-waiting)",
                                    },
                                    {
                                        key: "threads",
                                        label: "OS Threads",
                                        color: "var(--color-threads)",
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
			</div>

			<Card.Root>
				<Card.Header>
					<Card.Title>Scheduling Latency</Card.Title>
					<Card.Description>
						Time goroutines spent waiting to run, by duration bucket
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<HistogramChart
						buckets={schedMeta?.latenciesSecondsBuckets}
						format={fmtSecsAxis}
						series={[
                            {
                                key: "count",
                                counts: latest?.latenciesSeconds?.counts,
                                label: "Goroutines",
                                color: "var(--chart-1)",
                            },
                        ]}
					/>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>GC Pause Time</Card.Title>
					<Card.Description>
						Total stop-the-world pauses for garbage collection, by duration
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<HistogramChart
						buckets={schedMeta?.totalGcPauseSecondsBuckets}
						format={fmtSecsAxis}
						series={[
                            {
                                key: "count",
                                counts: latest?.totalGcPauseSeconds?.counts,
                                label: "Pauses",
                                color: "var(--chart-3)",
                            },
                        ]}
					/>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Stop-the-World Latency</Card.Title>
					<Card.Description>
						Time to bring all goroutines to a stop for GC, by duration
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<HistogramChart
						buckets={schedMeta?.stoppingGcSecondsBuckets}
						format={fmtSecsAxis}
						series={[
                            {
                                key: "count",
                                counts: latest?.stoppingGcSeconds?.counts,
                                label: "Stops",
                                color: "var(--chart-4)",
                            },
                        ]}
					/>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
</ScrollArea>
