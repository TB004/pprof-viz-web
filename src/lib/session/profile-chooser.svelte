<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	PlayIcon,
	PlusIcon,
	SlidersHorizontalIcon,
	SquareIcon,
} from "@lucide/svelte";
import { collectionService, profileService } from "#lib/app.svelte.js";
import Chip from "#lib/components/chip.svelte";
import ErrorAlert from "#lib/components/error-alert.svelte";
import { Button } from "#lib/components/ui/button";
import * as Select from "#lib/components/ui/select";
import { openProfileManager } from "#lib/profiles/state.svelte.js";
import { CollectionStatus, CollectionType } from "#lib/types";
import { fmtClock } from "#lib/utils";
import { chooser } from "./chooser.svelte.js";
import { sessionStatus } from "./status.js";
import StatusDot from "./status-dot.svelte";

const collectionState = collectionService.getState();
const catalog = profileService.getCatalog();
const profileOptions = $derived(profileService.profileOptions());

const isRunning = $derived(collectionState.status === CollectionStatus.Running);
const status = $derived(sessionStatus(collectionState));

const selected = $derived(
	profileOptions.find((p) => p.value === collectionState.selectedProfile),
);

const groups = $derived(
	catalog.projects
		.map((project) => ({
			id: project.id,
			name: project.name,
			options: profileOptions.filter((p) => p.projectId === project.id),
		}))
		.filter((group) => group.options.length > 0),
);

const startLabel = $derived(
	selected?.mode === CollectionType.Snapshot
		? "Take snapshot"
		: collectionState.collectedSamples > 0
			? "Start new collection"
			: "Start collecting",
);

function manage() {
	chooser.open = false;
	openProfileManager(collectionState.selectedProfile);
}
</script>

<div
	class="border-line bg-surface shadow-panel flex flex-col gap-2.5 rounded-xl border p-3"
>
	<div class="-mx-1 -mt-1 -mb-0.5 ml-0.5 flex items-center justify-between">
		<span class="eyebrow">Collection</span>
		<Button
			variant="ghost"
			size="icon-sm"
			aria-label="Manage profiles"
			onclick={manage}
		>
			<SlidersHorizontalIcon class="size-4" />
		</Button>
	</div>

	<Select.Root
		type="single"
		name="collection-profile"
		bind:open={chooser.open}
		disabled={isRunning}
		value={collectionState.selectedProfile}
		onValueChange={(value) => collectionService.selectProfile(value)}
	>
		<Select.Trigger
			class="h-auto! min-h-12 w-full cursor-pointer px-2.5 py-2 text-left disabled:cursor-not-allowed disabled:opacity-75"
		>
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="truncate text-[13.5px] font-[550]">
					{selected?.label ??
						(profileOptions.length ? "Choose a profile" : "No profiles yet")}
				</span>
				<span class="mono text-muted-foreground truncate text-[11px]">
					{#if selected}
						{selected.projectName}
						· {selected.url.host}
					{:else if profileOptions.length}
						{profileOptions.length}
						available
					{:else}
						Create one to begin
					{/if}
				</span>
			</span>
		</Select.Trigger>
		<Select.Content
			class="max-h-[min(26rem,var(--bits-select-content-available-height))] min-w-[260px]"
		>
			{#each groups as group (group.id)}
				<Select.Group>
					<Select.GroupHeading
						class="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-[0.06em] uppercase"
					>
						{group.name}
					</Select.GroupHeading>
					{#each group.options as option (option.value)}
						<Select.Item value={option.value} label={option.label} class="pr-2">
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="text-[13px] font-[550]">{option.label}</span>
								<span class="mono text-muted-foreground truncate text-[11px]">
									{option.url.host}
								</span>
							</span>
							<Chip>{option.mode}</Chip>
						</Select.Item>
					{/each}
				</Select.Group>
			{:else}
				<p class="text-muted-foreground px-2 py-2.5 text-[13px]">
					No profiles yet. Create one to start collecting.
				</p>
			{/each}
			<button
				type="button"
				class="border-line text-acc mt-1 flex w-full cursor-pointer items-center gap-2 border-t px-2 pt-2.5 pb-1.5 text-left text-[13px] font-medium"
				onclick={manage}
			>
				<PlusIcon class="size-4" />
				Manage profiles…
			</button>
		</Select.Content>
	</Select.Root>

	<div class="flex items-center gap-2 px-0.5 text-[12.5px]" aria-live="polite">
		<StatusDot tone={status.tone} />
		<span class="font-medium">{status.label}</span>
		<span class="mono text-muted-foreground ml-auto text-xs">
			{fmtClock(collectionState.elapsedSeconds)}
		</span>
	</div>

	<ErrorAlert class="text-xs" message={catalog.error} />

	{#if isRunning}
		<Button
			variant="destructive"
			class="w-full"
			onclick={() => collectionService.stopCollection()}
		>
			<SquareIcon class="size-3.5" />
			Stop collecting
		</Button>
	{:else}
		<Button
			class="w-full"
			disabled={!collectionState.selectedProfile}
			onclick={() => collectionService.startCollection()}
		>
			<PlayIcon class="size-3.5" />
			{startLabel}
		</Button>
	{/if}
</div>
