<script lang="ts">
import {
	ActivityIcon,
	CpuIcon,
	HistoryIcon,
	LayersIcon,
	PackageIcon,
	SettingsIcon,
} from "@lucide/svelte";
import { ProfileChooser } from "$lib/components/custom/app-sidebar";
import { PMDialog } from "$lib/components/custom/profile-manager-dialog";
import Separator from "$lib/components/ui/separator/separator.svelte";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";

const menuItems = [
	{ title: "CPU", url: "/cpu", icon: CpuIcon },
	{ title: "GC", url: "/gc", icon: ActivityIcon },
	{ title: "Memory", url: "/memory", icon: LayersIcon },
	{ title: "Scheduler", url: "/scheduler", icon: HistoryIcon },
	{ title: "Miscellaneous", url: "/miscellaneous", icon: PackageIcon },
];

let profileManagerOpen = $state(false);
</script>

<Sidebar.Root variant="floating">
	<Sidebar.Header>
		<div class="flex items-center gap-2">
			<img src="/logo.svg" alt="Pprof Viz Logo" class="h-8 w-8">
			<h1 class="text-lg font-semibold">Pprof-Viz</h1>
		</div>
	</Sidebar.Header>
	<Separator />
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
			<Sidebar.MenuItem>
				<Sidebar.MenuButton>
					{#snippet child({ props })}
						<a href="/settings" {...props}>
							<SettingsIcon />
							<span>Settings</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>

<PMDialog bind:open={profileManagerOpen} />
