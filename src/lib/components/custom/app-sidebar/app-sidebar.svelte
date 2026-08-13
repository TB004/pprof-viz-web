<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	ActivityIcon,
	ArchiveIcon,
	BracesIcon,
	CpuIcon,
	HistoryIcon,
	House,
	LayersIcon,
	PackageIcon,
	SettingsIcon,
} from "@lucide/svelte";
import { PMDialog } from "$lib/components/custom/profile-manager-dialog";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import { useWindowChrome } from "$lib/hooks/use-window-chrome.svelte.js";
import ProfileChooser from "./profile-chooser.svelte";

const menuItems = [
	{ title: "CPU", url: "/cpu", icon: CpuIcon },
	{ title: "GC", url: "/gc", icon: ActivityIcon },
	{ title: "Memory", url: "/memory", icon: LayersIcon },
	{ title: "Scheduler", url: "/scheduler", icon: HistoryIcon },
	{ title: "Miscellaneous", url: "/miscellaneous", icon: PackageIcon },
	{ title: "Raw", url: "/raw", icon: BracesIcon },
];

const footerItems = [
	{ title: "Home", url: "/", icon: House },
	{ title: "Archive", url: "/archive", icon: ArchiveIcon },
	{ title: "Settings", url: "/settings", icon: SettingsIcon },
];

let profileManagerOpen = $state(false);

const chrome = useWindowChrome();
</script>

<Sidebar.Root variant="sidebar">
	{#if chrome.isMac && !chrome.isFullscreen}
		<Sidebar.Header class="h-8" data-tauri-drag-region="deep"></Sidebar.Header>
	{/if}
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Application</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each menuItems as item (item.title)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton>
								{#snippet child({ props })}
									<a href={item.url} {...props}>
										<item.icon />
										<span>{item.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
		<Sidebar.Group>
			<ProfileChooser bind:profileManagerOpen />
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Footer>
		<Sidebar.Menu>
			{#each footerItems as item (item.title)}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton>
						{#snippet child({ props })}
							<a href={item.url} {...props}>
								<item.icon />
								<span>{item.title}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/each}
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>

<PMDialog bind:open={profileManagerOpen} />
