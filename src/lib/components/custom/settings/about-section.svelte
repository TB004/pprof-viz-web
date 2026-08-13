<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { getVersion } from "@tauri-apps/api/app";
import { onMount } from "svelte";
import * as Card from "$lib/components/ui/card/index.js";
import Ipc from "$lib/ipc";

let version = $state(new Promise<string>(() => {}));
let architecture = $state(new Promise<string>(() => {}));

onMount(() => {
	version = getVersion();
	architecture = Ipc.getArch();
});
</script>

<Card.Root class="border-border/60">
	<Card.Header>
		<Card.Title class="text-base">About</Card.Title>
		<Card.Description
			>Application information and legal notices.</Card.Description
		>
	</Card.Header>
	<Card.Content class="space-y-4">
		<div class="grid grid-cols-2 gap-y-3 text-sm">
			<span class="text-muted-foreground">Application</span>
			<span class="font-medium">Pprof-Viz</span>

			<span class="text-muted-foreground">Version</span>
			<span class="font-medium font-mono">
				{#await version}
					—
				{:then v}
					{v}
				{/await}
			</span>

			<span class="text-muted-foreground">Architecture</span>
			<span class="font-medium font-mono">
				{#await architecture}
					—
				{:then a}
					{a}
				{/await}
			</span>

			<span class="text-muted-foreground">Identifier</span>
			<span class="font-medium font-mono">de.tb004.pprof-viz</span>

			<span class="text-muted-foreground">Repository</span>
			<span>
				<button
					type="button"
					class="text-sm font-medium text-primary underline-offset-4 hover:underline"
					onclick={() =>
                        Ipc.open("https://github.com/TB004/pprof-viz")}
				>
					github.com/TB004/pprof-viz
				</button>
			</span>

			<span class="text-muted-foreground">Copyright</span>
			<span class="font-medium">Copyright &copy; 2026 Tizian Bahr</span>

			<span class="text-muted-foreground">License</span>
			<span class="font-medium">GPL-3 License</span>
		</div>
	</Card.Content>
</Card.Root>
