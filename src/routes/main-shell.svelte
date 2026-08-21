<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { CloudDownloadIcon } from "@lucide/svelte";
import type { Snippet } from "svelte";
import { page } from "$app/state";
import { SessionStatusBar } from "$lib/components/custom/session-status-bar";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import {
	applyUpdate,
	serviceWorkerState,
} from "$lib/pwa/service-worker.svelte.js";

type Props = { children: Snippet };
const { children }: Props = $props();

const routeLabel = $derived.by(() => {
	const routeSegment = page.url.pathname.split("/").filter(Boolean)[0];
	if (!routeSegment) return "Home";
	return routeSegment.charAt(0).toUpperCase() + routeSegment.slice(1);
});
</script>

<div class="flex h-svh flex-col">
	<header
		class="flex h-14 shrink-0 items-center justify-start border-b border-border/60 bg-background/80 px-4"
	>
		<Sidebar.Trigger />
		<div
			class="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-sm font-medium text-foreground shadow-sm ml-4"
		>
			<span>{routeLabel}</span>
			<span class="text-muted-foreground">&gt;</span>
		</div>
		{#if serviceWorkerState.updateReady}
			<button
				type="button"
				class="ml-auto inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
				onclick={applyUpdate}
			>
				<CloudDownloadIcon class="size-4" />
				Update available
			</button>
		{/if}
	</header>
	<div class="min-h-0 flex-1 overflow-hidden">{@render children()}</div>
	<SessionStatusBar />
</div>
