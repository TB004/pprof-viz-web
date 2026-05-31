<script lang="ts">
import {
	CircleAlert,
	CircleCheck,
	CloudDownload,
	LoaderCircleIcon,
	RefreshCwIcon,
} from "@lucide/svelte";
import { openUrl } from "@tauri-apps/plugin-opener";
import { onMount } from "svelte";
import type { UpdateStatus } from "$lib/bindings";
import { commands } from "$lib/bindings";
import * as Card from "$lib/components/ui/card/index.js";
import * as Tooltip from "$lib/components/ui/tooltip/index.js";
import { run } from "$lib/services/invoke.js";

type UpdateState =
	| { phase: "idle" }
	| { phase: "checking" }
	| { phase: "error"; message: string }
	| { phase: "up-to-date"; currentVersion: string }
	| { phase: "available"; status: UpdateStatus }
	| { phase: "downloading" };

let updateState = $state<UpdateState>({ phase: "idle" });

onMount(() => void checkForUpdates());

async function checkForUpdates() {
	updateState = { phase: "checking" };
	try {
		const status = await run(commands.checkUpdate());
		if (status.available) {
			updateState = { phase: "available", status };
		} else {
			updateState = {
				phase: "up-to-date",
				currentVersion: status.currentVersion,
			};
		}
	} catch (e) {
		updateState = { phase: "error", message: String(e) };
	}
}

async function installUpdate(status: UpdateStatus) {
	updateState = { phase: "downloading" };
	try {
		await run(
			commands.installUpdate(status.assetUrl ?? "", status.assetFilename ?? ""),
		);
	} catch (e) {
		updateState = { phase: "error", message: String(e) };
	}
}
</script>

<Card.Root class="border-border/60">
	<Card.Header>
		<Card.Title class="text-base">Updates</Card.Title>
		<Card.Description>Check for new releases from GitHub.</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if updateState.phase === "checking"}
			<div class="flex items-center gap-3 text-sm text-muted-foreground">
				<LoaderCircleIcon class="size-4 animate-spin" />
				Checking for updates…
			</div>
		{:else if updateState.phase === "up-to-date"}
			<div class="flex items-center justify-between gap-4">
				<div class="flex items-center gap-3 text-sm">
					<CircleCheck class="size-4 text-green-500" />
					<span>
						You're on the latest version
						<span class="ml-1 font-mono text-muted-foreground"
							>({updateState.currentVersion})</span
						>.
					</span>
				</div>
				<button
					type="button"
					class="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
					onclick={checkForUpdates}
				>
					<RefreshCwIcon class="size-3.5" />
					Check again
				</button>
			</div>
		{:else if updateState.phase === "available"}
			{@const s = updateState.status}
			<div class="space-y-4">
				<div class="flex items-start justify-between gap-4">
					<div class="space-y-1">
						<p class="text-sm font-medium">
							Version <span class="font-mono">{s.latestVersion}</span>
							is available
							<span class="ml-1 font-mono text-xs text-muted-foreground"
								>(current: {s.currentVersion})</span
							>
						</p>
						<button
							type="button"
							class="text-xs text-muted-foreground underline underline-offset-4 cursor-pointer"
							onclick={() => openUrl(s.releaseUrl)}
						>
							View release notes
						</button>
					</div>
					<button
						type="button"
						class="shrink-0 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						onclick={() => installUpdate(s)}
					>
						<CloudDownload class="size-4" />
						{s.assetUrl
                            ? "Download & install"
                            : "Open releases page"}
					</button>
				</div>
			</div>
		{:else if updateState.phase === "downloading"}
			<div class="flex items-center gap-3 text-sm text-muted-foreground">
				<LoaderCircleIcon class="size-4 animate-spin" />
				Downloading update… The app will close when ready.
			</div>
		{:else if updateState.phase === "error"}
			<div class="flex items-center justify-between gap-4">
				<div class="flex items-center gap-3 text-sm">
					<Tooltip.Root>
						<Tooltip.Trigger>
							<CircleAlert class="size-4 text-destructive" />
						</Tooltip.Trigger>
						<Tooltip.Portal>
							<Tooltip.Content class="max-w-xs text-xs">
								{updateState.message}
							</Tooltip.Content>
						</Tooltip.Portal>
					</Tooltip.Root>
					<span class="text-destructive">Failed to check for updates.</span>
				</div>
				<button
					type="button"
					class="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
					onclick={checkForUpdates}
				>
					<RefreshCwIcon class="size-3.5" />
					Retry
				</button>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
