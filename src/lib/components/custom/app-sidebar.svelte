<script lang="ts">
import {
	ActivityIcon,
	CpuIcon,
	HistoryIcon,
	LayersIcon,
	PackageIcon,
	Settings2Icon,
	SettingsIcon,
} from "@lucide/svelte";
import ProfileManagerDialog from "$lib/components/custom/profile-manager-dialog.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Select from "$lib/components/ui/select/index.js";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import * as CollectionService from "$lib/services/collection_service.js";
import { profileOptions } from "$lib/services/profile_service.js";
import Separator from "../ui/separator/separator.svelte";

const collectionState = CollectionService.collectionState;

const menuItems = [
	{ title: "CPU", url: "/cpu", icon: CpuIcon },
	{ title: "GC", url: "/gc", icon: ActivityIcon },
	{ title: "Memory", url: "/memory", icon: LayersIcon },
	{ title: "Scheduler", url: "/scheduler", icon: HistoryIcon },
	{ title: "Miscellaneous", url: "/miscellaneous", icon: PackageIcon },
];

let selectedProfile = $state<string | undefined>(undefined);
let profileManagerOpen = $state(false);

function handleProfileChange(value: string | undefined) {
	if (value === selectedProfile) {
		return;
	}

	selectedProfile = value;
	void CollectionService.selectProfile(value);
}

const triggerContent = $derived(
	$profileOptions.find((profile) => profile.value === selectedProfile)?.label ??
		"Select a profile",
);
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
		<Sidebar.Group>
			<Sidebar.GroupLabel>Measurement</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Card.Root>
					<Card.Header>
						<Card.Title>Choose a collection profile</Card.Title>
						<Card.Description>
							Select a stored profile before starting a profiling session.
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="flex items-start gap-2">
							<Select.Root
								type="single"
								name="collection-profile"
								disabled={$collectionState.status === "running"}
								value={selectedProfile}
								onValueChange={handleProfileChange}
							>
								<Select.Trigger class="w-full min-w-0">
									{triggerContent}
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										<Select.Label>Profiles</Select.Label>
										{#if $profileOptions.length === 0}
											<Select.Item value="" label="No profiles yet" disabled>
												No profiles yet
											</Select.Item>
										{:else}
											{#each $profileOptions as profile (profile.value)}
												<Select.Item
													value={profile.value}
													label={profile.label}
												>
													<div class="flex flex-col items-start">
														<span>{profile.label}</span>
														<span class="text-xs text-muted-foreground"
															>{profile.projectName}</span
														>
													</div>
												</Select.Item>
											{/each}
										{/if}
									</Select.Group>
								</Select.Content>
							</Select.Root>
							<Button
								variant="ghost"
								size="icon"
								class="shrink-0"
								onclick={() => (profileManagerOpen = true)}
							>
								<Settings2Icon />
							</Button>
						</div>
					</Card.Content>
				</Card.Root>
			</Sidebar.GroupContent>
			{#if $collectionState.status === "running"}
				<Button
					variant="destructive"
					class="mt-3"
					onclick={() => {
					CollectionService.stopCollection()}}
				>
					<span>Stop collecting</span>
				</Button>
			{:else}
				<Button
					variant="default"
					class="mt-3"
					disabled={!$collectionState.selectedProfile}
					onclick={() => CollectionService.startCollection()}
				>
					<span>Start collecting</span>
				</Button>
			{/if}
		</Sidebar.Group>
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

<ProfileManagerDialog bind:open={profileManagerOpen} />
