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

const uid = $props.id();
let showToken = $state(false);
</script>

{#snippet fieldLabel(
	id: string,
	text: string,
	hint: string,
)}
	<label for={id} class="mb-2 block text-[13px] font-[550]">
		{text}
		{#if hint}
			<span class="text-muted-foreground ml-1 font-normal">{hint}</span>
		{/if}
	</label>
{/snippet}

<div>
	{@render fieldLabel(`${uid}-name`, "Profile name", "")}
	<Input
		id="{uid}-name"
		bind:value={dialogState.profileName}
		placeholder="Production pprof"
	/>
</div>

<UrlField
	scheme={dialogState.profileScheme}
	host={dialogState.profileUrlHost}
	onSchemeChange={(v) => (dialogState.profileScheme = v)}
	onHostChange={(v) => (dialogState.profileUrlHost = v)}
/>

<div>
	{@render fieldLabel(`${uid}-token`, "Auth token", "optional")}
	<div class="flex gap-2">
		<Input
			id="{uid}-token"
			bind:value={dialogState.profileToken}
			placeholder="eyJ…"
			type={showToken ? "text" : "password"}
			autocomplete="off"
			class="mono flex-1"
		/>
		<Button
			variant="outline"
			size="icon"
			onclick={() => (showToken = !showToken)}
			aria-label={showToken ? "Hide token" : "Show token"}
		>
			{#if showToken}
				<EyeOffIcon />
			{:else}
				<EyeIcon />
			{/if}
		</Button>
	</div>
	<p class="text-muted-foreground mt-1.5 text-[12.5px]">
		Sent as a Bearer token in the authorization header.
	</p>
</div>

<ModePicker
	value={dialogState.profileMode}
	onChange={(v) => (dialogState.profileMode = v)}
/>

{#if dialogState.profileMode === CollectionType.Stream}
	<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
		<div>
			{@render fieldLabel(`${uid}-interval`, "Interval", "seconds")}
			<Input
				id="{uid}-interval"
				type="number"
				min={1}
				step={1}
				class="mono"
				bind:value={dialogState.profileIntervalSeconds}
			/>
		</div>
		<div>
			{@render fieldLabel(`${uid}-cycles`, "Cycles", "0 = until stopped")}
			<Input
				id="{uid}-cycles"
				type="number"
				min={0}
				step={1}
				class="mono"
				bind:value={dialogState.profileNumberOfCycles}
			/>
		</div>
	</div>
{/if}
