<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { settingsService } from "#lib/app.svelte.js";
import Input from "#lib/components/ui/input/input.svelte";
import ModePicker from "#lib/profiles/mode-picker.svelte";
import UrlField, {
	buildUrl,
	type Scheme,
	splitUrl,
} from "#lib/profiles/url-field.svelte";
import { CollectionType } from "#lib/types";
import Section from "./section.svelte";

const settings = settingsService.getSettings();
const uid = $props.id();

const url = $derived(splitUrl(settings.defaultUrl));

function setScheme(scheme: Scheme) {
	settingsService.updateSettings({ defaultUrl: buildUrl(scheme, url.host) });
}

function setHost(host: string) {
	settingsService.updateSettings({ defaultUrl: buildUrl(url.scheme, host) });
}
</script>

<Section
	id="defaults"
	title="Profile defaults"
	description="Pre-filled values when you create a new profile. Changes apply immediately."
>
	<div>
		<label for="{uid}-name" class="mb-2 block text-[13px] font-[550]">
			Default name
			<span class="text-muted-foreground ml-1 font-normal">optional</span>
		</label>
		<Input
			id="{uid}-name"
			value={settings.defaultName}
			placeholder="Production pprof"
			oninput={(e) =>
				settingsService.updateSettings({
					defaultName: e.currentTarget.value,
				})}
		/>
	</div>

	<UrlField
		label="Default collector URL"
		optional
		scheme={url.scheme}
		host={url.host}
		onSchemeChange={setScheme}
		onHostChange={setHost}
	/>

	<ModePicker
		value={settings.defaultMode}
		onChange={(v) => settingsService.updateSettings({ defaultMode: v })}
	/>

	{#if settings.defaultMode === CollectionType.Stream}
		<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
			<div>
				<label for="{uid}-interval" class="mb-2 block text-[13px] font-[550]">
					Interval
					<span class="text-muted-foreground ml-1 font-normal">seconds</span>
				</label>
				<Input
					id="{uid}-interval"
					type="number"
					min={1}
					step={1}
					class="mono"
					value={settings.defaultIntervalSeconds}
					oninput={(e) => {
						const v = Number.parseInt(e.currentTarget.value, 10);
						if (v >= 1)
							settingsService.updateSettings({
								defaultIntervalSeconds: v,
							});
					}}
				/>
			</div>
			<div>
				<label for="{uid}-cycles" class="mb-2 block text-[13px] font-[550]">
					Cycles
					<span class="text-muted-foreground ml-1 font-normal">
						0 = until stopped
					</span>
				</label>
				<Input
					id="{uid}-cycles"
					type="number"
					min={0}
					step={1}
					class="mono"
					value={settings.defaultNumberOfCycles}
					oninput={(e) => {
						const v = Number.parseInt(e.currentTarget.value, 10);
						if (v >= 0)
							settingsService.updateSettings({
								defaultNumberOfCycles: v,
							});
					}}
				/>
			</div>
		</div>
	{/if}
</Section>
