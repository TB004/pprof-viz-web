<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "@lucide/svelte";
import * as Card from "$lib/components/ui/card/index.js";
import { settingsService } from "$lib/services";
import { ThemeMode } from "$lib/types";

const themeOptions: Array<{
	value: ThemeMode;
	label: string;
	icon: typeof MonitorIcon;
}> = [
	{ value: ThemeMode.System, label: "System", icon: MonitorIcon },
	{ value: ThemeMode.Light, label: "Light", icon: SunIcon },
	{ value: ThemeMode.Dark, label: "Dark", icon: MoonIcon },
];

const settings = settingsService.getSettings();
</script>

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
					{@const isSelected = settings.theme === option.value}
					<button
						type="button"
						class={`relative flex flex-col items-center gap-3 rounded-xl border p-4 text-sm font-medium transition-colors ${isSelected ? "border-primary bg-primary/5 text-foreground" : "border-border/70 bg-muted/25 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
						onclick={() => settingsService.updateSettings({ theme: option.value })}
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
