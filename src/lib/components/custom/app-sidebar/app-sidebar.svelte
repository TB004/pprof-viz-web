<script lang="ts">
import {
	ActivityIcon,
	ArchiveIcon,
	BracesIcon,
	CpuIcon,
	HistoryIcon,
	HomeIcon,
	LayersIcon,
	PackageIcon,
	SettingsIcon,
} from "@lucide/svelte";
import { ProfileChooser } from "$lib/components/custom/app-sidebar";
import { PMDialog } from "$lib/components/custom/profile-manager-dialog";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";

const menuItems = [
	{ title: "CPU", url: "/cpu", icon: CpuIcon },
	{ title: "GC", url: "/gc", icon: ActivityIcon },
	{ title: "Memory", url: "/memory", icon: LayersIcon },
	{ title: "Scheduler", url: "/scheduler", icon: HistoryIcon },
	{ title: "Miscellaneous", url: "/miscellaneous", icon: PackageIcon },
	{ title: "Raw", url: "/raw", icon: BracesIcon },
];

const footerItems = [
	{ title: "Home", url: "/", icon: HomeIcon },
	{ title: "Archive", url: "/archive", icon: ArchiveIcon },
	{ title: "Settings", url: "/settings", icon: SettingsIcon },
];

let profileManagerOpen = $state(false);
</script>

<Sidebar.Root variant="floating">
	<!--
		Empty drag region that reserves vertical space for the macOS traffic
		lights (positioned by the OS at the top-left of the window). Kept
		platform-agnostic — Linux/Windows just see an empty top strip, which
		is harmless cosmetically.

		`deep` makes the entire subtree draggable; Tauri's drag handler still
		opts out of clickable elements (buttons, links, inputs) automatically.
	-->
	<Sidebar.Header class="h-8" data-tauri-drag-region="deep"></Sidebar.Header>
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
		<Sidebar.Group> <ProfileChooser bind:profileManagerOpen /> </Sidebar.Group>
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
