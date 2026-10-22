<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { settingsService } from "#lib/app.svelte.js";
import * as Card from "#lib/components/ui/card/index.js";
import Input from "#lib/components/ui/input/input.svelte";
import ModePicker from "#lib/profiles/mode-picker.svelte";
import UrlField, {
	buildUrl,
	type Scheme,
	splitUrl,
} from "#lib/profiles/url-field.svelte";
import { CollectionType } from "#lib/types";

const settings = settingsService.getSettings();

const url = $derived(splitUrl(settings.defaultUrl));

function setScheme(scheme: Scheme) {
	settingsService.updateSettings({ defaultUrl: buildUrl(scheme, url.host) });
}

function setHost(host: string) {
	settingsService.updateSettings({ defaultUrl: buildUrl(url.scheme, host) });
}
</script>

<Card.Root class="border-border/60">
	<Card.Header>
		<Card.Title class="text-base">Profile Defaults</Card.Title>
		<Card.Description>
			Pre-filled values when creating a new profile. Changes apply immediately.
		</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		<label class="block">
			<span class="mb-3 block text-sm font-medium text-foreground">
				Default name
				<span class="ml-1 font-normal text-muted-foreground">(optional)</span>
			</span>
			<Input
				value={settings.defaultName}
				placeholder="Production pprof"
				oninput={(e) =>
					settingsService.updateSettings({
						defaultName: e.currentTarget.value,
					})}
			/>
		</label>

		<UrlField
			label="Default URL"
			optional
			scheme={url.scheme}
			host={url.host}
			onSchemeChange={setScheme}
			onHostChange={setHost}
		/>

		<ModePicker
			label="Collection mode"
			value={settings.defaultMode}
			onChange={(v) => settingsService.updateSettings({ defaultMode: v })}
		/>

		{#if settings.defaultMode === CollectionType.Stream}
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
						value={settings.defaultIntervalSeconds}
						oninput={(e) => {
							const v = Number.parseInt(e.currentTarget.value, 10);
							if (v >= 1)
								settingsService.updateSettings({
									defaultIntervalSeconds: v,
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
						value={settings.defaultNumberOfCycles}
						oninput={(e) => {
							const v = Number.parseInt(e.currentTarget.value, 10);
							if (v >= 0)
								settingsService.updateSettings({
									defaultNumberOfCycles: v,
								});
						}}
					/>
				</label>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
