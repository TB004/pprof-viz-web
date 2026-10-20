<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { onDestroy } from "svelte";
import "./layout.css";
import { AppSidebar } from "#lib/components/custom/app-sidebar";
import * as Sidebar from "#lib/components/ui/sidebar/index.js";
import { collectionService } from "#lib/services";
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
