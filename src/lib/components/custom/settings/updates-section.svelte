<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	CircleCheck,
	CloudDownload,
	CloudOffIcon,
	LoaderCircleIcon,
	RefreshCwIcon,
} from "@lucide/svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Card from "#lib/components/ui/card/index.js";
import { serviceWorkerService } from "#lib/services";

const swState = serviceWorkerService.getState();
</script>

<Card.Root class="border-border/60">
	<Card.Header>
		<Card.Title class="text-base">Offline &amp; updates</Card.Title>
		<Card.Description>
			The app installs itself into the browser cache so it keeps working without
			a connection to the server it is hosted on.
		</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if !swState.supported}
			<div class="flex items-center gap-3 text-sm text-muted-foreground">
				<CloudOffIcon class="size-4" />
				This browser does not support offline installation.
			</div>
		{:else if swState.updateReady}
			<div class="flex items-start justify-between gap-4">
				<div class="space-y-1">
					<p class="text-sm font-medium">A newer version is ready.</p>
					<p class="text-sm text-muted-foreground">
						Reloading swaps it in. Any running collection is stopped.
					</p>
				</div>
				<Button
					class="shrink-0"
					onclick={() => serviceWorkerService.applyUpdate()}
				>
					<CloudDownload class="size-4" />
					Reload to update
				</Button>
			</div>
		{:else}
			<div class="flex items-center justify-between gap-4">
				<div class="flex items-center gap-3 text-sm">
					{#if swState.ready}
						<CircleCheck class="size-4 text-green-500" />
						<span>
							Available offline{swState.installed
								? ", running as an installed app"
								: ""}.
						</span>
					{:else}
						<LoaderCircleIcon
							class="size-4 animate-spin text-muted-foreground"
						/>
						<span class="text-muted-foreground"
							>Preparing offline support…</span
						>
					{/if}
				</div>
				<Button
					variant="outline"
					size="sm"
					class="shrink-0"
					disabled={!swState.ready || swState.checking}
					onclick={() => serviceWorkerService.checkForUpdate()}
				>
					{#if swState.checking}
						<LoaderCircleIcon class="size-3.5 animate-spin" />
						Checking…
					{:else}
						<RefreshCwIcon class="size-3.5" />
						Check for updates
					{/if}
				</Button>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
