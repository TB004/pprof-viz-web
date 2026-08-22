<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { PMDialog } from "$lib/components/custom/profile-manager-dialog";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import { dataRoutes, shellRoutes } from "$lib/routes";
import ProfileChooser from "./profile-chooser.svelte";

let profileManagerOpen = $state(false);
</script>

<Sidebar.Root variant="sidebar">
	<Sidebar.Header>
		<div class="flex items-center gap-2 px-2 py-1">
			<img src="/icons/icon-512.png" alt="" class="size-10 shrink-0">
			<span class="truncate text-lg font-semibold">Pprof-Viz</span>
		</div>
	</Sidebar.Header>
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
