<script lang="ts">
import { page } from "$app/state";
import "./layout.css";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import AppSidebar from "$lib/components/app-sidebar.svelte";
import { ModeWatcher } from "mode-watcher";
import SessionStatusBar from "$lib/components/session-status-bar.svelte";

let { children } = $props();

const routeLabel = $derived.by(() => {
    const routeSegment = page.url.pathname.split("/").filter(Boolean)[0];

    if (!routeSegment) {
        return "Home";
    }

    return routeSegment.charAt(0).toUpperCase() + routeSegment.slice(1);
});
</script>

<ModeWatcher />
<Sidebar.Provider>
    <AppSidebar />
    <Sidebar.Inset class="min-h-svh overflow-hidden">
        <div class="flex min-h-svh flex-col">
            <header class="flex h-14 shrink-0 items-center justify-start border-b border-border/60 px-4">
                <Sidebar.Trigger />
                <div class="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-sm font-medium text-foreground shadow-sm backdrop-blur ml-4">
                    <span>{routeLabel}</span>
                    <span class="text-muted-foreground">&gt;</span>
                </div>
            </header>
            <div class="min-h-0 flex-1 overflow-auto">
                {@render children?.()}
            </div>
            <SessionStatusBar />
        </div>
    </Sidebar.Inset>
</Sidebar.Provider>