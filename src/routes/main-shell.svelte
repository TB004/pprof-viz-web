<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	ChevronRightIcon,
	CloudDownloadIcon,
	MoonIcon,
	SunIcon,
} from "@lucide/svelte";
import type { Snippet } from "svelte";
import {
	collectionService,
	profileService,
	serviceWorkerService,
	settingsService,
} from "#lib/app.svelte.js";
import SaveCollection from "#lib/archive/save-collection.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Sidebar from "#lib/components/ui/sidebar/index.js";
import StatusBar from "#lib/session/status-bar.svelte";
import { page } from "$app/state";
import { allRoutes, sessionUrls } from "./nav.js";

type Props = { children: Snippet };
const { children }: Props = $props();

const swState = serviceWorkerService.getState();
const collectionState = collectionService.getState();
const catalog = profileService.getCatalog();

const route = $derived.by(() => {
	const path = page.url.pathname;
	return allRoutes.find((r) =>
		r.url === "/" ? path === "/" : path.startsWith(r.url),
	);
});

// Session pages say whose data they show; the rest say where they live.
const crumbs = $derived.by((): [string, string] => {
	if (!route || !sessionUrls.has(route.url)) {
		return [
			"Pprof-Viz",
			route?.url === "/archive" ? "Local data" : "Preferences",
		];
	}
	if (collectionState.loaded) {
		return ["Archive", collectionState.loadedName ?? "Collection"];
	}
	const profile = collectionState.selectedProfile
		? profileService.find(collectionState.selectedProfile)
		: undefined;
	const project = catalog.projects.find((p) => p.id === profile?.projectId);
	return [project?.name ?? "No project", profile?.name ?? "No profile"];
});

const dark = $derived(settingsService.isDark());
</script>

<div class="flex h-svh flex-col">
	<header
		class="border-line bg-surface flex min-h-15 shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2.5 sm:px-6"
	>
		<Sidebar.Trigger class="md:hidden" />
		<nav
			aria-label="Breadcrumb"
			class="text-muted-foreground flex min-w-0 items-center gap-2 text-[13px]"
		>
			<span class="truncate max-sm:hidden">{crumbs[0]}</span>
			<ChevronRightIcon class="text-faint size-3.5 shrink-0 max-sm:hidden" />
			<span class="truncate max-sm:hidden">{crumbs[1]}</span>
			<ChevronRightIcon class="text-faint size-3.5 shrink-0 max-sm:hidden" />
			<span class="text-ink truncate font-semibold" aria-current="page">
				{route?.title ?? ""}
			</span>
		</nav>
		<div class="ml-auto flex flex-wrap items-center gap-2">
			{#if swState.updateReady}
				<button
					type="button"
					class="border-acc-line bg-acc-soft text-acc inline-flex h-8 cursor-pointer items-center gap-[7px] rounded-full border px-3 text-[12.5px] font-[550]"
					onclick={() => serviceWorkerService.applyUpdate()}
				>
					<CloudDownloadIcon class="size-3.5" />
					Update available
				</button>
			{/if}
			<SaveCollection />
			<Button
				variant="outline"
				size="icon"
				aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
				onclick={() => settingsService.toggleTheme()}
			>
				{#if dark}
					<SunIcon />
				{:else}
					<MoonIcon />
				{/if}
			</Button>
		</div>
	</header>
	<div class="min-h-0 flex-1 overflow-hidden">{@render children()}</div>
	<StatusBar />
</div>
