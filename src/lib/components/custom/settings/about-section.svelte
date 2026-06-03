<script lang="ts">
import { getVersion } from "@tauri-apps/api/app";
import { onMount } from "svelte";
import { commands } from "$lib/bindings";
import * as Card from "$lib/components/ui/card/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";

let version = $state(new Promise<string>(() => {}));
let architecture = $state(new Promise<string>(() => {}));

onMount(() => {
	version = getVersion();
	architecture = commands.getArch();
});

const licenseText = `MIT License

Copyright (c) 2026 Tizian Bahr

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
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
                        commands.open("https://github.com/TB004/pprof-viz")}
				>
					github.com/TB004/pprof-viz
				</button>
			</span>

			<span class="text-muted-foreground">Copyright</span>
			<span class="font-medium">Copyright &copy; 2026 Tizian Bahr</span>

			<span class="text-muted-foreground">License</span>
			<span>
				<Dialog.Root>
					<Dialog.Trigger
						class="text-sm font-medium text-primary underline-offset-4 hover:underline"
					>
						MIT License
					</Dialog.Trigger>
					<Dialog.Portal>
						<Dialog.Overlay />
						<Dialog.Content class="max-w-lg">
							<Dialog.Header>
								<Dialog.Title>MIT License</Dialog.Title>
							</Dialog.Header>
							<ScrollArea
								class="mt-2 max-h-[60vh] rounded-md bg-muted"
								scrollbarYClasses="mr-1"
							>
								<pre
									class="whitespace-pre-wrap p-4 text-xs leading-relaxed text-muted-foreground"
								>{licenseText}</pre>
							</ScrollArea>
						</Dialog.Content>
					</Dialog.Portal>
				</Dialog.Root>
			</span>
		</div>
	</Card.Content>
</Card.Root>
