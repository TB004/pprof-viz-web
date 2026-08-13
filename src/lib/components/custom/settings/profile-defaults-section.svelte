<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	buildUrl,
	ModePicker,
	parseUrl,
	type Scheme,
	UrlField,
} from "$lib/components/custom/profile-form";
import * as Card from "$lib/components/ui/card/index.js";
import Input from "$lib/components/ui/input/input.svelte";
import { SettingsService } from "$lib/services";
import { CollectionType, HttpVersion } from "$lib/types";

const settings = SettingsService.settings;

const url = $derived(parseUrl(settings.defaultUrl));

function setScheme(scheme: Scheme) {
	SettingsService.updateSettings({ defaultUrl: buildUrl(scheme, url.host) });
}

function setHost(host: string) {
	SettingsService.updateSettings({ defaultUrl: buildUrl(url.scheme, host) });
}

// HTTP/3 implies https, so both fields go out in one patch — two sequential
// `updateSettings` calls would race, the second overwriting the first.
function setHttpVersion(httpVersion: HttpVersion) {
	SettingsService.updateSettings({
		defaultHttpVersion: httpVersion,
		...(httpVersion === HttpVersion.Http3
			? { defaultUrl: buildUrl("https", url.host) }
			: {}),
	});
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
                    SettingsService.updateSettings({
                        defaultName: e.currentTarget.value,
                    })}
			/>
		</label>

		<UrlField
			label="Default URL"
			optional
			scheme={url.scheme}
			host={url.host}
			httpVersion={settings.defaultHttpVersion}
			onSchemeChange={setScheme}
			onHostChange={setHost}
			onHttpVersionChange={setHttpVersion}
		/>

		<ModePicker
			label="Collection mode"
			value={settings.defaultMode}
			onChange={(v) => SettingsService.updateSettings({ defaultMode: v })}
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
                            const v = Number.parseInt(
                                e.currentTarget.value,
                                10,
                            );
                            if (v >= 1)
                                SettingsService.updateSettings({
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
                            const v = Number.parseInt(
                                e.currentTarget.value,
                                10,
                            );
                            if (v >= 0)
                                SettingsService.updateSettings({
                                    defaultNumberOfCycles: v,
                                });
                        }}
					/>
				</label>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
