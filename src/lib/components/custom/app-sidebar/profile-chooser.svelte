<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { PlayIcon, Settings2Icon, SquareIcon } from "@lucide/svelte";
import { Button } from "$lib/components/ui/button";
import { ScrollArea } from "$lib/components/ui/scroll-area";
import * as Select from "$lib/components/ui/select";
import { CollectionService, ProfileService } from "$lib/services";
import { CollectionStatus } from "$lib/types";

type Props = {
	profileManagerOpen: boolean;
};

let { profileManagerOpen = $bindable() }: Props = $props();

const collectionState = CollectionService.collectionState;
const profileOptions = $derived(ProfileService.profileOptions());

const isRunning = $derived(collectionState.status === CollectionStatus.Running);

const triggerContent = $derived(
	profileOptions.find((p) => p.value === collectionState.selectedProfile)
		?.label ?? "Select a profile",
);

async function handleProfileChange(value?: string) {
	await CollectionService.selectProfile(value);
}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center justify-between pl-1">
		<p class="text-sidebar-foreground/70 text-xs font-medium">
			Collection profile
		</p>
		<Button
			variant="ghost"
			size="icon-sm"
			onclick={() => (profileManagerOpen = true)}
		>
			<Settings2Icon class="size-3.5" />
			<span class="sr-only">Manage profiles</span>
		</Button>
	</div>

	<Select.Root
		type="single"
		name="collection-profile"
		disabled={isRunning}
		value={collectionState.selectedProfile}
		onValueChange={handleProfileChange}
	>
		<Select.Trigger class="w-full">
			<span class="truncate">{triggerContent}</span>
		</Select.Trigger>
		<Select.Content>
			<Select.Group>
				<Select.Label>Profiles</Select.Label>
				{#if profileOptions.length === 0}
					<Select.Item value="" label="No profiles yet" disabled>
						No profiles yet
					</Select.Item>
				{:else}
					<ScrollArea class="h-80">
						{#each profileOptions as profile (profile.value)}
							<Select.Item value={profile.value} label={profile.label}>
								<div class="flex flex-col items-start gap-0.5">
									<span>{profile.label}</span>
									<span class="text-muted-foreground text-xs">
										{profile.projectName}
									</span>
								</div>
							</Select.Item>
						{/each}
					</ScrollArea>
				{/if}
			</Select.Group>
		</Select.Content>
	</Select.Root>

	{#if isRunning}
		<Button
			variant="destructive"
			class="w-full"
			onclick={() => CollectionService.stopCollection()}
		>
			<SquareIcon class="size-3.5" />
			<span>Stop collecting</span>
		</Button>
	{:else}
		<Button
			variant="default"
			class="w-full"
			disabled={!collectionState.selectedProfile}
			onclick={() => CollectionService.startCollection()}
		>
			<PlayIcon class="size-3.5" />
			<span>Start collecting</span>
		</Button>
	{/if}
</div>
