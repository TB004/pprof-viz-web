<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	AboutSection,
	AppearanceSection,
	DangerZoneSection,
	ProfileDefaultsSection,
	UpdatesSection,
} from "#lib/components/custom/settings";
import { ScrollArea } from "#lib/components/ui/scroll-area/index.js";
</script>

<ScrollArea class="h-full mr-2">
	<div class="mx-auto max-w-2xl space-y-8 px-6 py-10">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Settings</h1>
			<p class="mt-1.5 text-sm text-muted-foreground">
				Customize the application to your preferences.
			</p>
		</div>
		<AppearanceSection />
		<ProfileDefaultsSection />
		<DangerZoneSection />
		<UpdatesSection />
		<AboutSection />
	</div>
</ScrollArea>
