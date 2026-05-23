<script lang="ts">
import {
	ActivityIcon,
	BracesIcon,
	CheckIcon,
	ChevronsRightIcon,
	CpuIcon,
	HistoryIcon,
	LayersIcon,
	ListPlusIcon,
	MousePointerClickIcon,
	PackageIcon,
	PlayIcon,
} from "@lucide/svelte";
import type { Component } from "svelte";
import { PMDialog } from "$lib/components/custom/profile-manager-dialog";
import { Button } from "$lib/components/ui/button";
import * as Card from "$lib/components/ui/card";
import { CollectionService } from "$lib/services";
import { profileOptions } from "$lib/services/profile_service.js";
import { CollectionStatus } from "$lib/types";

const collectionState = CollectionService.collectionState;

const hasProfiles = $derived($profileOptions.length > 0);
const hasSelectedProfile = $derived(!!$collectionState.selectedProfile);
const isRunning = $derived(
	$collectionState.status === CollectionStatus.Running,
);

const activeStep = $derived(
	!hasProfiles ? 1 : !hasSelectedProfile ? 2 : !isRunning ? 3 : 0,
);

let profileManagerOpen = $state(false);

const setupSteps: {
	icon: Component;
	title: string;
	description: string;
}[] = [
	{
		icon: ListPlusIcon,
		title: "Create a profile",
		description:
			"Add a project and configure a connection profile for your Go service.",
	},
	{
		icon: MousePointerClickIcon,
		title: "Select a profile",
		description: "Choose a profile from the collection panel in the sidebar.",
	},
	{
		icon: PlayIcon,
		title: "Start collecting",
		description:
			'Click "Start collecting" in the sidebar to begin streaming telemetry.',
	},
];

const dataRoutes: { title: string; url: string; icon: Component }[] = [
	{ title: "CPU", url: "/cpu", icon: CpuIcon },
	{ title: "GC", url: "/gc", icon: ActivityIcon },
	{ title: "Memory", url: "/memory", icon: LayersIcon },
	{ title: "Scheduler", url: "/scheduler", icon: HistoryIcon },
	{ title: "Miscellaneous", url: "/miscellaneous", icon: PackageIcon },
	{ title: "Raw", url: "/raw", icon: BracesIcon },
];
</script>

<div class="flex h-full flex-col items-center justify-center p-8">
	<div class="w-full max-w-xl space-y-10">
		<!-- Hero -->
		<div class="space-y-2 text-center">
			<div class="mb-5 flex justify-center">
				<div
					class="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 shadow-sm"
				>
					<ActivityIcon class="size-7 text-foreground/85" />
				</div>
			</div>
			<h1 class="text-xl font-semibold tracking-tight">
				{#if isRunning}
					Collection in progress
				{:else}
					Get started with Pprof-Viz
				{/if}
			</h1>
			<p class="text-sm text-muted-foreground">
				{#if isRunning}
					Navigate to a dashboard to explore your live Go runtime telemetry.
				{:else}
					Complete the steps below to begin streaming Go runtime telemetry.
				{/if}
			</p>
		</div>

		{#if isRunning}
			<!-- Running: show dashboard links -->
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each dataRoutes as route (route.url)}
					<a href={route.url} class="group">
						<Card.Root
							class="cursor-pointer border-border/60 transition-colors hover:border-primary/50 hover:bg-muted/30"
						>
							<Card.Content class="flex items-center gap-3 p-4">
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
								>
									<route.icon class="size-4" />
								</div>
								<span class="text-sm font-medium">{route.title}</span>
								<ChevronsRightIcon
									class="ml-auto size-3.5 text-muted-foreground/50 transition-colors group-hover:text-primary"
								/>
							</Card.Content>
						</Card.Root>
					</a>
				{/each}
			</div>
		{:else}
			<!-- Setup steps -->
			<div class="space-y-3">
				{#each setupSteps as step, i (step.title)}
					{@render setupStep(
                        i + 1,
                        step.icon,
                        step.title,
                        step.description,
                    )}
				{/each}
			</div>

			{#if activeStep === 1}
				<div class="flex justify-center">
					<Button onclick={() => (profileManagerOpen = true)} class="px-6">
						<ListPlusIcon class="size-4" />
						Open Profile Manager
					</Button>
				</div>
			{/if}
		{/if}
	</div>
</div>

{#snippet setupStep(
    num: number,
    Icon: Component,
    title: string,
    description: string,
)}
	{@const done = num < activeStep || activeStep === 0}
	{@const active = num === activeStep}
	<Card.Root
		class={[
            "border transition-colors",
            active
                ? "border-primary/40 bg-primary/5 shadow-sm"
                : done
                  ? "border-border/40 bg-muted/20"
                  : "border-border/40 opacity-50",
        ].join(" ")}
	>
		<Card.Content class="flex items-center gap-4 p-4">
			<div
				class={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    done
                        ? "border-transparent bg-primary text-primary-foreground"
                        : active
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground",
                ].join(" ")}
			>
				{#if done}
					<CheckIcon class="size-3.5" />
				{:else}
					{num}
				{/if}
			</div>
			<div class="min-w-0 flex-1 space-y-0.5">
				<p
					class={[
                        "text-sm font-medium",
                        done
                            ? "text-muted-foreground line-through"
                            : "text-foreground",
                    ].join(" ")}
				>
					{title}
				</p>
				<p class="text-xs text-muted-foreground">{description}</p>
			</div>
			{#if active}
				<div class="shrink-0 animate-pulse text-primary">
					<Icon class="size-4" />
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
{/snippet}

<PMDialog bind:open={profileManagerOpen} />
