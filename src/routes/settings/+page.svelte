<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { ScrollArea } from "#lib/components/ui/scroll-area/index.js";
import About from "./about.svelte";
import Appearance from "./appearance.svelte";
import Backup from "./backup.svelte";
import DangerZone from "./danger-zone.svelte";
import ProfileDefaults from "./profile-defaults.svelte";
import Updates from "./updates.svelte";
</script>

<ScrollArea class="h-full mr-2">
	<div class="mx-auto max-w-2xl space-y-8 px-6 py-10">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Settings</h1>
			<p class="mt-1.5 text-sm text-muted-foreground">
				Customize the application to your preferences.
			</p>
		</div>
		<Appearance />
		<ProfileDefaults />
		<Backup />
		<DangerZone />
		<Updates />
		<About />
	</div>
</ScrollArea>
