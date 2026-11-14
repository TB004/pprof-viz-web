<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { MonitorIcon, MoonIcon, SunIcon } from "@lucide/svelte";
import { settingsService } from "#lib/app.svelte.js";
import { ThemeMode } from "#lib/settings.svelte.js";
import Section from "./section.svelte";

// Each preview is a miniature of the app in that palette; "System" shows both.
const themeOptions = [
	{
		value: ThemeMode.System,
		label: "System",
		icon: MonitorIcon,
		side: "linear-gradient(135deg,#f1f4f8 50%,#0a1020 50%)",
		main: "linear-gradient(135deg,#ffffff 50%,#0e1527 50%)",
		card: "#94a3b8",
		bar: "#94a3b8",
	},
	{
		value: ThemeMode.Light,
		label: "Light",
		icon: SunIcon,
		side: "#f1f4f8",
		main: "#ffffff",
		card: "#e2e7ee",
		bar: "#cdd5df",
	},
	{
		value: ThemeMode.Dark,
		label: "Dark",
		icon: MoonIcon,
		side: "#0a1020",
		main: "#0e1527",
		card: "#1b2640",
		bar: "#2a3756",
	},
];

const settings = settingsService.getSettings();
</script>

<Section
	id="appearance"
	title="Appearance"
	description="Choose how Pprof-Viz looks on this device."
>
	<div role="radiogroup" aria-label="Theme" class="grid grid-cols-3 gap-3">
		{#each themeOptions as option (option.value)}
			<label
				class="border-line-2 bg-surface text-ink hover:border-faint has-checked:border-acc has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus) flex cursor-pointer flex-col gap-2.5 rounded-xl border p-2.5 text-left text-[13px] font-medium has-checked:shadow-[0_0_0_3px_var(--acc-soft)]"
			>
				<input
					type="radio"
					name="theme"
					class="sr-only"
					checked={settings.theme === option.value}
					onchange={() =>
						settingsService.updateSettings({ theme: option.value })}
				>
				<span
					aria-hidden="true"
					class="border-line flex h-[74px] overflow-hidden rounded-lg border"
				>
					<span
						class="flex w-[28%] flex-col gap-[5px] px-1.5 py-2"
						style:background={option.side}
					>
						{#each [70, 100, 80] as width (width)}
							<i
								class="block h-1.5 rounded-[3px]"
								style:background={option.bar}
								style:width="{width}%"
							></i>
						{/each}
					</span>
					<span
						class="flex flex-1 flex-col gap-1.5 p-2"
						style:background={option.main}
					>
						<i
							class="block h-[22px] rounded"
							style:background={option.card}
						></i>
						<i class="block h-1.5 w-1/2 rounded-[3px] bg-[#22d3ee]"></i>
						<i
							class="block h-1.5 w-3/4 rounded-[3px]"
							style:background={option.bar}
						></i>
					</span>
				</span>
				<span class="flex items-center gap-2">
					<option.icon class="size-4" />
					{option.label}
				</span>
			</label>
		{/each}
	</div>
</Section>
