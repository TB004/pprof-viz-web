<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	CircleCheckIcon,
	CircleXIcon,
	LoaderCircleIcon,
	PlugZapIcon,
} from "@lucide/svelte";
import { profileService } from "#lib/app.svelte.js";
import { Button } from "#lib/components/ui/button/index.js";
import { assembleUrl, dialogState } from "./state.svelte.js";

type PingStatus = "idle" | "pending" | "success" | "error";

let pingStatus = $state<PingStatus>("idle");
let pingError = $state("");
let pingResetTimer: ReturnType<typeof setTimeout> | undefined;

// Reset the ping result whenever the URL changes so stale indicators don't persist.
$effect(() => {
	const _host = dialogState.profileUrlHost;
	const _scheme = dialogState.profileScheme;
	pingStatus = "idle";
	pingError = "";
});

async function testConnection() {
	const url = assembleUrl();
	const host = dialogState.profileUrlHost.trim();
	if (!host) {
		return;
	}

	try {
		new URL(url);
	} catch {
		pingStatus = "error";
		pingError = "Invalid URL format";
		return;
	}

	const token = dialogState.profileToken.trim();

	clearTimeout(pingResetTimer);
	pingStatus = "pending";
	pingError = "";

	try {
		await profileService.ping(url, token || null);
		pingStatus = "success";
	} catch (err) {
		pingStatus = "error";
		pingError = err instanceof Error ? err.message : "Connection failed";
	}

	pingResetTimer = setTimeout(() => {
		pingStatus = "idle";
		pingError = "";
	}, 4000);
}
</script>

<div class="flex flex-col gap-2">
	<Button
		variant="outline"
		disabled={pingStatus === "pending" || !dialogState.profileUrlHost.trim()}
		class={pingStatus === "success"
			? "border-green-500/40 bg-green-500/10 text-green-600 hover:bg-green-500/15 hover:text-green-600"
			: pingStatus === "error"
				? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
				: ""}
		onclick={testConnection}
	>
		{#if pingStatus === "pending"}
			<LoaderCircleIcon class="size-4 animate-spin" />
			<span>Testing...</span>
		{:else if pingStatus === "success"}
			<CircleCheckIcon class="size-4" />
			<span>Connected</span>
		{:else if pingStatus === "error"}
			<CircleXIcon class="size-4" />
			<span>Unreachable</span>
		{:else}
			<PlugZapIcon class="size-4" />
			<span>Test connection</span>
		{/if}
	</Button>
	{#if pingStatus === "error" && pingError}
		<p class="text-sm text-destructive">{pingError}</p>
	{/if}
</div>
