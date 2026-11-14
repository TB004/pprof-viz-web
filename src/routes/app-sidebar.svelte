<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { archiveService, collectionService } from "#lib/app.svelte.js";
import * as Sidebar from "#lib/components/ui/sidebar/index.js";
import ManagerDialog from "#lib/profiles/manager-dialog.svelte";
import { latestUtilisation } from "#lib/session/metrics.js";
import ProfileChooser from "#lib/session/profile-chooser.svelte";
import { fmtBytesAxis, fmtCount, fmtCountAxis, fmtPercent } from "#lib/utils";
import { page } from "$app/state";
import {
	dashboardRoutes,
	dataRoutes,
	type NavRoute,
	overviewRoute,
	settingsRoute,
} from "./nav.js";

const sidebar = Sidebar.useSidebar();
const collectionState = collectionService.getState();
const archiveState = archiveService.getState();

// A glanceable figure next to each page, from the newest sample.
const figures = $derived.by((): Record<string, string> => {
	const frames = collectionState.data ?? [];
	const latest = frames.at(-1);
	const archived = archiveState.collections.length;
	const out: Record<string, string> = {
		"/archive": archived ? String(archived) : "",
	};
	if (!latest) return out;
	const utilisation = latestUtilisation(frames);
	out["/cpu"] = utilisation === undefined ? "" : fmtPercent(utilisation);
	out["/gc"] = fmtCountAxis(Number(latest.gc?.totalCycles ?? 0));
	out["/memory"] = fmtBytesAxis(Number(latest.memory?.totalBytes ?? 0));
	out["/scheduler"] =
		`${fmtCountAxis(latest.scheduler?.liveGoroutines ?? 0)} g`;
	out["/raw"] = fmtCount(frames.length);
	return out;
});

function isActive(url: string): boolean {
	const path = page.url.pathname;
	return url === "/" ? path === "/" : path.startsWith(url);
}
</script>

{#snippet navItem(route: NavRoute)}
	<a
		href={route.url}
		aria-current={isActive(route.url) ? "page" : undefined}
		class="text-ink-2 hover:bg-hover hover:text-ink aria-[current=page]:bg-sel aria-[current=page]:text-ink flex h-[38px] items-center gap-2.5 rounded-control px-2.5 text-[13.5px] aria-[current=page]:font-semibold [&[aria-current=page]>svg]:text-acc"
		onclick={() => sidebar.setOpenMobile(false)}
	>
		<route.icon class="size-4 shrink-0" />
		<span class="flex-1 truncate">{route.title}</span>
		<span class="mono text-muted-foreground text-[11.5px] font-normal">
			{figures[route.url] ?? ""}
		</span>
	</a>
{/snippet}

<Sidebar.Root collapsible="offcanvas">
	<Sidebar.Header class="gap-[18px] px-3.5 pt-[18px] pb-0">
		<div class="flex items-center gap-[11px] px-1.5 py-0.5">
			<img src="/icons/logo.svg" alt="" class="size-8 shrink-0">
			<div class="min-w-0">
				<div class="text-[15.5px] font-[650] tracking-[-0.01em]">Pprof-Viz</div>
				<div class="text-muted-foreground text-[11.5px]">
					Go runtime telemetry
				</div>
			</div>
		</div>
		<ProfileChooser />
	</Sidebar.Header>

	<Sidebar.Content class="gap-0.5 px-3.5 pt-[18px]">
		<nav aria-label="Pages" class="flex flex-col gap-0.5">
			{@render navItem(overviewRoute)}
			<div class="eyebrow px-2.5 pt-3.5 pb-1.5">Dashboards</div>
			{#each dashboardRoutes as route (route.url)}
				{@render navItem(route)}
			{/each}
			<div class="eyebrow px-2.5 pt-3.5 pb-1.5">Data</div>
			{#each dataRoutes as route (route.url)}
				{@render navItem(route)}
			{/each}
		</nav>
	</Sidebar.Content>

	<Sidebar.Footer class="px-3.5 pt-0 pb-3.5">
		<div class="border-line flex flex-col gap-0.5 border-t pt-2.5">
			{@render navItem(settingsRoute)}
		</div>
	</Sidebar.Footer>
</Sidebar.Root>

<ManagerDialog />
