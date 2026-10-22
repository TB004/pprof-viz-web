<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import * as Sidebar from "#lib/components/ui/sidebar/index.js";
import ManagerDialog from "#lib/profiles/manager-dialog.svelte";
import ProfileChooser from "#lib/session/profile-chooser.svelte";
import { dataRoutes, shellRoutes } from "./nav.js";
</script>

<Sidebar.Root variant="floating">
	<Sidebar.Header>
		<div class="flex items-center gap-2 px-2 py-1">
			<img src="/icons/icon-512.png" alt="" class="size-10 shrink-0">
			<span class="truncate text-xl font-semibold pl-4">Pprof-Viz</span>
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
								{#snippet child({
									props,
								})}
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
			<ProfileChooser />
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Footer>
		<Sidebar.Menu>
			{#each shellRoutes as item (item.url)}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton>
						{#snippet child({
							props,
						})}
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

<ManagerDialog />
