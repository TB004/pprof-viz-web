<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { EyeIcon, EyeOffIcon } from "@lucide/svelte";
import { Button } from "#lib/components/ui/button/index.js";
import Input from "#lib/components/ui/input/input.svelte";
import { CollectionType } from "#lib/types";
import ModePicker from "./mode-picker.svelte";
import { dialogState } from "./state.svelte.js";
import UrlField from "./url-field.svelte";

let showToken = $state(false);
</script>

<label class="block">
	<span class="mb-3 block text-sm font-medium text-foreground">
		Profile name
	</span>
	<Input bind:value={dialogState.profileName} placeholder="Production pprof" />
</label>

<UrlField
	scheme={dialogState.profileScheme}
	host={dialogState.profileUrlHost}
	onSchemeChange={(v) => (dialogState.profileScheme = v)}
	onHostChange={(v) => (dialogState.profileUrlHost = v)}
/>

<div class="block">
	<span class="mb-3 block text-sm font-medium text-foreground">
		Auth token
		<span class="ml-1 font-normal text-muted-foreground">(optional)</span>
	</span>
	<div class="flex gap-2">
		<Input
			bind:value={dialogState.profileToken}
			placeholder="eyJ..."
			type={showToken ? "text" : "password"}
			class="flex-1"
		/>
		<Button
			variant="outline"
			size="icon"
			onclick={() => (showToken = !showToken)}
			aria-label={showToken ? "Hide token" : "Show token"}
		>
			{#if showToken}
				<EyeOffIcon class="size-4" />
			{:else}
				<EyeIcon class="size-4" />
			{/if}
		</Button>
	</div>
</div>

<ModePicker
	value={dialogState.profileMode}
	onChange={(v) => (dialogState.profileMode = v)}
/>

{#if dialogState.profileMode === CollectionType.Stream}
	<div class="grid gap-4 sm:grid-cols-2">
		<label class="block">
			<span class="mb-3 block text-sm font-medium text-foreground">
				Interval
				<span class="ml-1 font-normal text-muted-foreground">(seconds)</span>
			</span>
			<Input
				type="number"
				min={1}
				step={1}
				bind:value={dialogState.profileIntervalSeconds}
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
				bind:value={dialogState.profileNumberOfCycles}
			/>
		</label>
	</div>
{/if}
