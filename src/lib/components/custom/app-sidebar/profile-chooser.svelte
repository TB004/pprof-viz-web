<script lang="ts">
import { Settings2Icon } from "@lucide/svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Select from "$lib/components/ui/select/index.js";
import { CollectionService } from "$lib/services";
import { profileOptions } from "$lib/services/profile_service.js";

type Props = {
	collectionState: typeof CollectionService.collectionState;
	selectedProfile: string | undefined;
	triggerContent: string;
	profileManagerOpen: boolean;
};

let {
	collectionState,
	selectedProfile,
	triggerContent,
	profileManagerOpen = $bindable(),
}: Props = $props();

async function handleProfileChange(value: string | undefined) {
	if (value === selectedProfile) {
		return;
	}

	selectedProfile = value;
	await CollectionService.selectProfile(value);
}
</script>

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
								<Select.Item value={profile.value} label={profile.label}>
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
