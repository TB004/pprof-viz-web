<script lang="ts">
import type { Snippet } from "svelte";
import { onMount } from "svelte";
import { page } from "$app/state";
import { SessionStatusBar } from "$lib/components/custom/session-status-bar";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import { useSidebar } from "$lib/components/ui/sidebar/index.js";

type Props = { children: Snippet };
const { children }: Props = $props();

const sidebar = useSidebar();

const routeLabel = $derived.by(() => {
	const routeSegment = page.url.pathname.split("/").filter(Boolean)[0];
	if (!routeSegment) return "Home";
	return routeSegment.charAt(0).toUpperCase() + routeSegment.slice(1);
});

// macOS keeps the traffic lights pinned to the top-left of the window even
// when the sidebar is collapsed. Reserve ~80px of left padding on the main
// header in that case so the trigger and the route badge don't sit
// underneath the dots.
let isMac = $state(false);
onMount(() => {
	isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
});

const reserveTrafficLightSpace = $derived(
	isMac && (sidebar.state === "collapsed" || !sidebar.open),
);
</script>

<div class="flex h-svh flex-col">
	<!--
		`deep` makes the whole header subtree draggable. Tauri's drag handler
		automatically excludes clickable elements (`<button>`, `<a>`, etc.)
		so the sidebar trigger keeps working without an explicit opt-out.
	-->
	<header
		data-tauri-drag-region="deep"
		class={[
            "flex h-14 shrink-0 items-center justify-start border-b border-border/60 bg-background/80 px-4 backdrop-blur supports-backdrop-filter:bg-background/70",
            reserveTrafficLightSpace && "pl-25",
        ]}
	>
		<Sidebar.Trigger />
		<div
			class="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-sm font-medium text-foreground shadow-sm backdrop-blur ml-4"
		>
			<span>{routeLabel}</span>
			<span class="text-muted-foreground">&gt;</span>
		</div>
	</header>
	<div class="min-h-0 flex-1 overflow-hidden">{@render children()}</div>
	<SessionStatusBar />
</div>
