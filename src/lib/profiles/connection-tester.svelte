<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	CircleCheckIcon,
	LoaderCircleIcon,
	PlugIcon,
	TriangleAlertIcon,
} from "@lucide/svelte";
import { profileService } from "#lib/app.svelte.js";
import { Button } from "#lib/components/ui/button/index.js";
import { assembleUrl, dialogState } from "./state.svelte.js";

// The "Test connection" button. Its outcome lives in `dialogState`, so the
// editor can show it next to the fields it is about.

// Reset the ping result whenever the URL changes so stale indicators don't persist.
$effect(() => {
	void dialogState.profileUrlHost;
	void dialogState.profileScheme;
	dialogState.pingStatus = "idle";
	dialogState.pingMessage = "";
});

async function testConnection() {
	const url = assembleUrl();
	if (!dialogState.profileUrlHost.trim()) return;

	try {
		new URL(url);
	} catch {
		dialogState.pingStatus = "error";
		dialogState.pingMessage = "Invalid URL format";
		return;
	}

	const token = dialogState.profileToken.trim();
	dialogState.pingStatus = "pending";
	dialogState.pingMessage = "";
	const started = performance.now();

	try {
		await profileService.ping(url, token || null);
		dialogState.pingStatus = "success";
		dialogState.pingMessage = `Collector answered Ping in ${Math.round(performance.now() - started)} ms.`;
	} catch (err) {
		dialogState.pingStatus = "error";
		dialogState.pingMessage = `Unreachable — ${err instanceof Error ? err.message : "connection failed"}. Check CORS on the collector and that its certificate is trusted.`;
	}
}
</script>

<Button
	variant={dialogState.pingStatus === "success"
		? "success"
		: dialogState.pingStatus === "error"
			? "destructive"
			: "outline"}
	disabled={dialogState.pingStatus === "pending" ||
		!dialogState.profileUrlHost.trim()}
	onclick={testConnection}
>
	{#if dialogState.pingStatus === "pending"}
		<LoaderCircleIcon class="animate-spin" />
		Testing…
	{:else if dialogState.pingStatus === "success"}
		<CircleCheckIcon />
		Connected
	{:else if dialogState.pingStatus === "error"}
		<TriangleAlertIcon />
		Unreachable
	{:else}
		<PlugIcon />
		Test connection
	{/if}
</Button>
