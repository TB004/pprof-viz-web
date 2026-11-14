<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import {
	CircleCheckIcon,
	CloudDownloadIcon,
	CloudOffIcon,
	LoaderCircleIcon,
	RefreshCwIcon,
} from "@lucide/svelte";
import { serviceWorkerService } from "#lib/app.svelte.js";
import ErrorAlert from "#lib/components/error-alert.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { Task } from "#lib/task.svelte.js";
import Section from "./section.svelte";

const swState = serviceWorkerService.getState();
const checking = new Task();
</script>

<Section
	id="updates"
	title="Offline & updates"
	description="The app installs itself into the browser cache so it keeps working without the server it is hosted on."
>
	<div class="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
		<div class="flex items-center gap-2.5">
			{#if !swState.supported}
				<CloudOffIcon class="text-muted-foreground size-4 shrink-0" />
			{:else if swState.updateReady}
				<CloudDownloadIcon class="text-acc size-4 shrink-0" />
			{:else if swState.ready}
				<CircleCheckIcon class="text-ok size-4 shrink-0" />
			{:else}
				<LoaderCircleIcon
					class="text-muted-foreground size-4 shrink-0 animate-spin"
				/>
			{/if}
			<div>
				<div class="text-[13.5px] font-[550]">
					{#if !swState.supported}
						Offline use is unavailable
					{:else if swState.updateReady}
						A newer version is ready
					{:else if swState.ready}
						Available offline{swState.installed
							? ", running as an installed app"
							: ""}
					{:else}
						Preparing offline support…
					{/if}
				</div>
				<div class="text-muted-foreground mt-0.5 max-w-[460px] text-[13px]">
					{#if !swState.supported}
						This browser does not support offline installation.
					{:else if swState.updateReady}
						Reloading swaps it in. A running collection is stopped.
					{:else}
						The app shell is cached in this browser.
					{/if}
				</div>
			</div>
		</div>
		{#if swState.updateReady}
			<Button onclick={() => serviceWorkerService.applyUpdate()}>
				<CloudDownloadIcon class="size-3.5" />
				Reload to update
			</Button>
		{:else if swState.supported}
			<Button
				variant="outline"
				disabled={!swState.ready || swState.checking}
				onclick={() =>
					checking.run(() => serviceWorkerService.checkForUpdate())}
			>
				{#if swState.checking}
					<LoaderCircleIcon class="size-3.5 animate-spin" />
					Checking…
				{:else}
					<RefreshCwIcon class="size-3.5" />
					Check for updates
				{/if}
			</Button>
		{/if}
	</div>
	<ErrorAlert message={checking.error} />
</Section>
