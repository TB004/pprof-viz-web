<script lang="ts">
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import {
	ActivityIcon,
	CpuIcon,
	LayersIcon,
	HistoryIcon,
	PackageIcon,
	SettingsIcon,
	Settings2Icon,
} from "@lucide/svelte";
import Separator from "./ui/separator/separator.svelte";
import * as Card from "$lib/components/ui/card/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Select from "$lib/components/ui/select/index.js";
import {
	CollectionService,
	collectionProfiles,
	collectionState,
} from "$lib/services/collection_service.js";

const menuItems = [
	{
		title: "CPU",
		url: "/cpu",
		icon: CpuIcon,
	},
	{
		title: "GC",
		url: "/gc",
		icon: ActivityIcon,
	},
	{
		title: "Memory",
		url: "/memory",
		icon: LayersIcon,
	},
	{
		title: "Scheduler",
		url: "/scheduler",
		icon: HistoryIcon,
	},
	{
		title: "Miscellaneous",
		url: "/miscellaneous",
		icon: PackageIcon,
	},
];
let selectedProfile = $state("");

const triggerContent = $derived(
	collectionProfiles.find((p) => p.value === selectedProfile)?.label ??
		"Select a profile",
);

$effect(() => {
	CollectionService.selectProfile(selectedProfile);
});
</script>

<Sidebar.Root variant="floating">
    <Sidebar.Header>
        <div class="flex items-center gap-2">
            <img src="/logo.svg" alt="Pprof Viz Logo" class="w-8 h-8" />
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
                        <Card.Title>Choose a collection profile:</Card.Title>
                        <Card.Description>
                            You can select or create a custom collection profile for your profiling sessions.
                        </Card.Description>
                    </Card.Header>
                    <Card.Content>
                        <div class="flex">
                            <Select.Root
                                type="single"
                                name="collection-profile"
                                disabled={$collectionState.status === "running"}
                                bind:value={selectedProfile}
                            >
                                <Select.Trigger class="w-full">
                                    {triggerContent}
                                </Select.Trigger>
                                <Select.Content>
                                    <Select.Group>
                                        <Select.Label>Profiles</Select.Label>
                                        {#each collectionProfiles as profile (profile.value)}
                                            <Select.Item
                                                value={profile.value}
                                                label={profile.label}
                                            >
                                                {profile.label}
                                            </Select.Item>
                                        {/each}
                                    </Select.Group>
                                </Select.Content>
                            </Select.Root>
                            <Button variant="ghost" class="ml-1" onclick={() => {}}>
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
                        CollectionService.stopCollection();
                        CollectionService.reset();
                    }}
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
