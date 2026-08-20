<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { PMDialog } from "$lib/components/custom/profile-manager-dialog";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import { useWindowChrome } from "$lib/hooks/use-window-chrome.svelte.js";
import { dataRoutes, shellRoutes } from "$lib/routes";
import ProfileChooser from "./profile-chooser.svelte";

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
					{#each dataRoutes as item (item.url)}
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
			{#each shellRoutes as item (item.url)}
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
