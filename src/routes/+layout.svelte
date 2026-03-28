<script lang="ts">
import "./layout.css";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import AppSidebar from "$lib/components/app-sidebar.svelte";
import { ModeWatcher } from "mode-watcher";
import SessionStatusBar from "$lib/components/session-status-bar.svelte";

let { children } = $props();
</script>

<ModeWatcher />
<Sidebar.Provider>
    <AppSidebar />
    <Sidebar.Inset class="min-h-svh overflow-hidden">
        <div class="flex min-h-svh flex-col">
            <header class="flex h-14 shrink-0 items-center border-b border-border/60 px-4">
                <Sidebar.Trigger />
            </header>
            <div class="min-h-0 flex-1 overflow-auto">
                {@render children?.()}
            </div>
            <SessionStatusBar />
        </div>
    </Sidebar.Inset>
</Sidebar.Provider>