<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { PlayIcon } from "@lucide/svelte";
import type { Component, Snippet } from "svelte";
import { collectionService, profileService } from "#lib/app.svelte.js";
import EmptyState from "#lib/components/empty-state.svelte";
import PageShell from "#lib/components/page-shell.svelte";
import Segmented from "#lib/components/segmented.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { sessionStatus } from "#lib/session/status.js";
import StatusDot from "#lib/session/status-dot.svelte";
import { CollectionStatus } from "#lib/types";
import { sampleWindow, WINDOW_OPTIONS } from "./sample-window.svelte.js";

let {
	title,
	description,
	icon,
	children,
}: {
	title: string;
	description: string;
	/** Shown in the empty state. */
	icon: Component;
	/** The dashboard itself; rendered once there is a sample. */
	children: Snippet;
} = $props();

const collectionState = collectionService.getState();
const status = $derived(sessionStatus(collectionState));
const hasData = $derived((collectionState.data?.length ?? 0) > 0);
const isRunning = $derived(collectionState.status === CollectionStatus.Running);
const hasProfiles = $derived(profileService.profileOptions().length > 0);

const empty = $derived.by(() => {
	if (isRunning && status.tone === "connecting") {
		return {
			title: "Connecting to the collector…",
			text: "Frames will appear here as soon as they arrive.",
		};
	}
	if (!hasProfiles) {
		return {
			title: "No profile yet",
			text: "Create a profile in the profile manager, then start collecting.",
		};
	}
	return {
		title: "No data collected yet",
		text: collectionState.selectedProfileLabel
			? `Start collecting from ${collectionState.selectedProfileLabel} to fill this view.`
			: "Choose a profile in the Collection panel, then start collecting.",
	};
});
</script>

<PageShell {title} {description}>
	{#snippet actions()}
		<div class="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
			<Segmented
				label="Time window"
				options={WINDOW_OPTIONS}
				bind:value={sampleWindow.size}
			/>
			<div
				class="border-line bg-surface inline-flex h-8 items-center gap-[7px] rounded-full border px-3 text-[12.5px] font-medium"
			>
				<StatusDot tone={status.tone} />
				{status.label}
			</div>
		</div>
	{/snippet}

	{#if hasData}
		{@render children()}
	{:else}
		<EmptyState {icon} title={empty.title}>
			{empty.text}
			{#snippet action()}
				{#if !isRunning && collectionState.selectedProfile}
					<Button onclick={() => collectionService.startCollection()}>
						<PlayIcon class="size-3.5" />
						Start collecting
					</Button>
				{/if}
			{/snippet}
		</EmptyState>
	{/if}
</PageShell>
