<script lang="ts">
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "@lucide/svelte";
import { setMode, userPrefersMode } from "mode-watcher";
import * as Card from "$lib/components/ui/card/index.js";
import Input from "$lib/components/ui/input/input.svelte";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { ProfileService, SettingsService } from "$lib/services";

type ThemeMode = "system" | "light" | "dark";

const themeOptions: Array<{
	value: ThemeMode;
	label: string;
	icon: typeof MonitorIcon;
}> = [
	{ value: "system", label: "System", icon: MonitorIcon },
	{ value: "light", label: "Light", icon: SunIcon },
	{ value: "dark", label: "Dark", icon: MoonIcon },
];

const modeOptions: Array<{
	value: ProfileService.CollectionType;
	title: string;
	description: string;
}> = [
	{
		value: ProfileService.CollectionType.Snapshot,
		title: "Snapshot",
		description: "Capture a focused point-in-time profile.",
	},
	{
		value: ProfileService.CollectionType.Stream,
		title: "Stream",
		description: "Continuously follow runtime changes.",
	},
];

const profileDefaults = SettingsService.profileDefaults;
</script>

<ScrollArea class="h-full mr-2">
	<div class="mx-auto max-w-2xl space-y-8 px-6 py-10">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Settings</h1>
			<p class="mt-1.5 text-sm text-muted-foreground">
				Customize the application to your preferences.
			</p>
		</div>

		<!-- Appearance -->
		<Card.Root class="border-border/60">
			<Card.Header>
				<Card.Title class="text-base">Appearance</Card.Title>
				<Card.Description
					>Choose how pprof-viz looks on your device.</Card.Description
				>
			</Card.Header>
			<Card.Content>
				<div>
					<p class="mb-3 text-sm font-medium text-foreground">Theme</p>
					<div class="grid grid-cols-3 gap-3">
						{#each themeOptions as option (option.value)}
							{@const isSelected =
                                userPrefersMode.current === option.value}
							<button
								type="button"
								class={`relative flex flex-col items-center gap-3 rounded-xl border p-4 text-sm font-medium transition-colors ${isSelected ? "border-primary bg-primary/5 text-foreground" : "border-border/70 bg-muted/25 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
								onclick={() => setMode(option.value)}
							>
								<option.icon class="size-5" />
								<span>{option.label}</span>
								{#if isSelected}
									<div
										class="absolute right-2.5 top-2.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
									>
										<CheckIcon class="size-2.5" />
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Profile Defaults -->
		<Card.Root class="border-border/60">
			<Card.Header>
				<Card.Title class="text-base">Profile Defaults</Card.Title>
				<Card.Description>
					Pre-filled values when creating a new profile. Changes apply
					immediately.
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-6">
				<label class="block">
					<span class="mb-3 block text-sm font-medium text-foreground">
						Default name
						<span class="ml-1 font-normal text-muted-foreground"
							>(optional)</span
						>
					</span>
					<Input
						value={$profileDefaults.name}
						placeholder="Production pprof"
						oninput={(e) =>
							SettingsService.updateProfileDefaults({
								name: e.currentTarget.value,
							})}
					/>
				</label>

				<label class="block">
					<span class="mb-3 block text-sm font-medium text-foreground">
						Default URL
						<span class="ml-1 font-normal text-muted-foreground"
							>(optional)</span
						>
					</span>
					<Input
						value={$profileDefaults.url}
						placeholder="http://localhost:9090"
						oninput={(e) =>
                            SettingsService.updateProfileDefaults({
                                url: e.currentTarget.value,
                            })}
					/>
				</label>

				<div>
					<p class="mb-3 text-sm font-medium text-foreground">
						Collection mode
					</p>
					<div class="grid gap-3 sm:grid-cols-2">
						{#each modeOptions as option (option.value)}
							{@const isSelected =
                                $profileDefaults.mode === option.value}
							<button
								type="button"
								class={`rounded-2xl border p-4 text-left transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border/70 bg-muted/25 hover:border-primary/30"}`}
								onclick={() =>
                                    SettingsService.updateProfileDefaults({
                                        mode: option.value,
                                    })}
							>
								<div class="flex items-start justify-between gap-3">
									<div>
										<p class="text-base font-semibold text-foreground">
											{option.title}
										</p>
										<p class="mt-1 text-sm text-muted-foreground">
											{option.description}
										</p>
									</div>
									<div
										class={`flex h-5 w-6 items-center justify-center rounded-full border ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
									>
										{#if isSelected}
											<CheckIcon class="size-3.5" />
										{/if}
									</div>
								</div>
							</button>
						{/each}
					</div>
				</div>

				{#if $profileDefaults.mode === ProfileService.CollectionType.Stream}
					<div class="grid gap-4 sm:grid-cols-2">
						<label class="block">
							<span class="mb-3 block text-sm font-medium text-foreground">
								Interval
								<span class="ml-1 font-normal text-muted-foreground"
									>(seconds)</span
								>
							</span>
							<Input
								type="number"
								min={1}
								step={1}
								value={$profileDefaults.intervalSeconds}
								oninput={(e) => {
                                    const v = Number.parseInt(
                                        e.currentTarget.value,
                                        10,
                                    );
                                    if (v >= 1)
                                        SettingsService.updateProfileDefaults({
                                            intervalSeconds: v,
                                        });
                                }}
							/>
						</label>
						<label class="block">
							<span class="mb-3 block text-sm font-medium text-foreground">
								Cycles
								<span class="ml-1 font-normal text-muted-foreground"
									>(0 = infinite)</span
								>
							</span>
							<Input
								type="number"
								min={0}
								step={1}
								value={$profileDefaults.numberOfCycles}
								oninput={(e) => {
                                    const v = Number.parseInt(
                                        e.currentTarget.value,
                                        10,
                                    );
                                    if (v >= 0)
                                        SettingsService.updateProfileDefaults({
                                            numberOfCycles: v,
                                        });
                                }}
							/>
						</label>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</ScrollArea>
