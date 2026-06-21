<script lang="ts">
import { ArchiveIcon, HardDriveIcon } from "@lucide/svelte";
import { onMount } from "svelte";
import {
	ChartCard,
	CollectionTable,
	DeleteDialog,
	EditDialog,
	type Slice,
} from "$lib/components/custom/archive";
import * as Card from "$lib/components/ui/card";
import { ScrollArea } from "$lib/components/ui/scroll-area";
import { fmtBytes } from "$lib/format";
import { ArchiveService } from "$lib/services";
import type { CollectionRow } from "$lib/types";

const archiveState = ArchiveService.archiveState;

onMount(() => {
	void ArchiveService.refresh();
});

const collections = $derived($archiveState.collections);
const disk = $derived($archiveState.diskUsage);
const hasCollections = $derived(collections.length > 0);

// Cycle through the theme chart colors for slices.
const CHART_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

function withColors(
	items: { id: string; label: string; value: number }[],
): Slice[] {
	return items
		.filter((i) => i.value > 0)
		.map((i, idx) => ({
			...i,
			color: CHART_COLORS[idx % CHART_COLORS.length],
		}));
}

// Used-vs-free disk, with our collections broken out as their own slice.
const diskSlices = $derived<Slice[]>(
	disk
		? withColors([
				{
					id: "collections",
					label: "Collections",
					value: disk.collectionsBytes,
				},
				{
					id: "other",
					label: "Other used",
					value: Math.max(
						0,
						disk.totalBytes - disk.freeBytes - disk.collectionsBytes,
					),
				},
				{ id: "free", label: "Free", value: Math.max(0, disk.freeBytes) },
			])
		: [],
);

const perCollectionSlices = $derived<Slice[]>(
	withColors(
		collections.map((c) => ({ id: c.id, label: c.name, value: c.sizeBytes })),
	),
);

const perProfileSlices = $derived<Slice[]>(
	withColors(
		Object.entries(
			collections.reduce<Record<string, number>>((acc, c) => {
				const key = c.profileName || c.profileUrl || "Unknown";
				acc[key] = (acc[key] ?? 0) + c.sizeBytes;
				return acc;
			}, {}),
		).map(([label, value]) => ({ id: label, label, value })),
	),
);

let deleteTarget = $state<CollectionRow | null>(null);
let editTarget = $state<CollectionRow | null>(null);
</script>

<ScrollArea class="h-full mr-2">
	<div class="flex min-h-full flex-col gap-6 p-6">
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold">Archive</h1>
				<p class="text-muted-foreground text-sm">
					Saved collections stored locally as .ppvz files
				</p>
			</div>
			<div
				class="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-sm shadow-sm"
			>
				<HardDriveIcon class="size-4 text-muted-foreground" />
				<span class="font-medium tabular-nums">
					{fmtBytes(disk?.collectionsBytes ?? 0)}
				</span>
				<span class="text-muted-foreground"
					>used by
					{collections.length}
					collection{collections.length === 1 ? "" : "s"}</span
				>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<ChartCard
				title="Disk usage"
				description="Collections vs other used vs free space"
				slices={diskSlices}
				donut
			/>
			<ChartCard
				title="By collection"
				description="Disk footprint of each saved collection"
				slices={perCollectionSlices}
			/>
			<ChartCard
				title="By source"
				description="Footprint grouped by originating profile"
				slices={perProfileSlices}
			/>
		</div>

		{#if hasCollections}
			<Card.Root class="py-0">
				<Card.Content class="p-0">
					<CollectionTable
						{collections}
						onEdit={(row) => (editTarget = row)}
						onDelete={(row) => (deleteTarget = row)}
					/>
				</Card.Content>
			</Card.Root>
		{:else}
			<div class="flex flex-1 items-center justify-center">
				<Card.Root class="w-fit border-dashed">
					<Card.Content
						class="flex flex-col items-center gap-3 px-16 py-12 text-center"
					>
						<div
							class="bg-muted flex h-12 w-12 items-center justify-center rounded-full"
						>
							<ArchiveIcon class="text-muted-foreground size-6" />
						</div>
						<div>
							<p class="font-medium">No saved collections</p>
							<p class="text-muted-foreground text-sm">
								Collect some metrics, then use
								<span class="font-medium">Save</span>
								in the status bar to store them here.
							</p>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		{/if}
	</div>
</ScrollArea>

<DeleteDialog bind:target={deleteTarget} />
<EditDialog bind:target={editTarget} />
