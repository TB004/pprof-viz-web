<script lang="ts">
import "./layout.css";
import { AppSidebar } from "$lib/components/custom/app-sidebar";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import MainShell from "./main-shell.svelte";

let { children } = $props();
</script>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset class="h-svh overflow-hidden">
		<MainShell>{@render children?.()}</MainShell>
	</Sidebar.Inset>
</Sidebar.Provider>
