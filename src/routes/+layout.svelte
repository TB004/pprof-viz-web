<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { onDestroy } from "svelte";
import "./layout.css";
import { collectionService } from "#lib/app.svelte.js";
import * as Sidebar from "#lib/components/ui/sidebar/index.js";
import AppSidebar from "./app-sidebar.svelte";
import MainShell from "./main-shell.svelte";

let { children } = $props();

onDestroy(() => {
	collectionService.cleanup();
});
</script>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset class="h-svh overflow-hidden">
		<MainShell>{@render children?.()}</MainShell>
	</Sidebar.Inset>
</Sidebar.Provider>
