<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	ArchiveIcon,
	CloudDownloadIcon,
	InfoIcon,
	SlidersHorizontalIcon,
	SunIcon,
	TriangleAlertIcon,
} from "@lucide/svelte";
import PageShell from "#lib/components/page-shell.svelte";
import About from "./about.svelte";
import Appearance from "./appearance.svelte";
import Backup from "./backup.svelte";
import DangerZone from "./danger-zone.svelte";
import ProfileDefaults from "./profile-defaults.svelte";
import Updates from "./updates.svelte";

const sections = [
	{ id: "appearance", label: "Appearance", icon: SunIcon },
	{ id: "defaults", label: "Profile defaults", icon: SlidersHorizontalIcon },
	{ id: "backup", label: "Backup", icon: ArchiveIcon },
	{ id: "updates", label: "Offline & updates", icon: CloudDownloadIcon },
	{ id: "about", label: "About", icon: InfoIcon },
	{ id: "danger", label: "Danger zone", icon: TriangleAlertIcon },
];
</script>

<PageShell
	title="Settings"
	description="Stored in this browser’s localStorage."
>
	<div class="flex max-w-[1040px] flex-wrap items-start gap-7">
		<nav
			aria-label="Settings sections"
			class="sticky top-0 flex max-w-[220px] flex-[1_1_180px] flex-col gap-0.5 max-md:hidden"
		>
			{#each sections as section (section.id)}
				<a
					href="#{section.id}"
					class="hover:bg-hover hover:text-ink flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] {section.id ===
					"danger"
						? "text-bad"
						: "text-ink-2"}"
				>
					<section.icon class="size-4" />
					{section.label}
				</a>
			{/each}
		</nav>
		<div class="flex min-w-0 flex-[999_1_520px] flex-col gap-[18px]">
			<Appearance />
			<ProfileDefaults />
			<Backup />
			<Updates />
			<About />
			<DangerZone />
		</div>
	</div>
</PageShell>
