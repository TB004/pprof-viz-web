<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { TriangleAlertIcon } from "@lucide/svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { Checkbox } from "#lib/components/ui/checkbox/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import { transferService } from "#lib/services";
import {
	BundleCredentials,
	type ExportOptions,
	type ExportScope,
} from "#lib/types";

type Props = {
	open: boolean;
	title: string;
	subtitle: string;
	exportScope: ExportScope;
	/** The filename stem, without the `.ppvzb` extension. */
	suggestedName: string;
	/** How many profiles the scope covers; credentials are hidden when none. */
	profileCount?: number;
	/** False for a scope that can hold no archives, which hides the toggle. */
	canIncludeArchives?: boolean;
};

let {
	open = $bindable(),
	title,
	subtitle,
	exportScope,
	suggestedName,
	profileCount = 0,
	canIncludeArchives = true,
}: Props = $props();

const uid = $props.id();
const transferState = transferService.getState();

let includeArchives = $state(true);
let includeCredentials = $state(false);
let passphrase = $state("");

// A fresh dialog always starts from the safe defaults, whatever the last one
// was left on.
$effect(() => {
	if (open) {
		includeArchives = true;
		includeCredentials = false;
		passphrase = "";
	}
});

const credentials = $derived(
	!includeCredentials
		? BundleCredentials.None
		: passphrase.trim()
			? BundleCredentials.Encrypted
			: BundleCredentials.Plain,
);

function cancel() {
	open = false;
}

async function confirm() {
	const options: ExportOptions = {
		includeArchives: includeArchives && canIncludeArchives,
		credentials,
		passphrase: passphrase.trim() || undefined,
	};
	const ok = await transferService.exportBundle(
		exportScope,
		options,
		suggestedName,
	);
	if (ok) open = false;
}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{subtitle}</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-4">
			{#if canIncludeArchives}
				<label for="{uid}-archives" class="flex items-start gap-2.5 text-sm">
					<Checkbox
						id="{uid}-archives"
						class="mt-0.5"
						bind:checked={includeArchives}
					/>
					<span>
						Include saved collections
						<span class="block text-xs text-muted-foreground">
							Archives have no link back to a profile, so they are matched by
							the profile name and URL they were captured with.
						</span>
					</span>
				</label>
			{/if}

			{#if profileCount > 0}
				<label for="{uid}-credentials" class="flex items-start gap-2.5 text-sm">
					<Checkbox
						id="{uid}-credentials"
						class="mt-0.5"
						bind:checked={includeCredentials}
					/>
					<span>
						Include profile tokens
						<span class="block text-xs text-muted-foreground">
							Off by default. Imported profiles otherwise ask for their
							credentials again.
						</span>
					</span>
				</label>

				{#if includeCredentials}
					<div class="flex flex-col gap-1.5 pl-6">
						<label for="{uid}-passphrase" class="text-sm font-medium">
							Passphrase <span class="text-muted-foreground">(optional)</span>
						</label>
						<Input
							id="{uid}-passphrase"
							type="password"
							autocomplete="new-password"
							bind:value={passphrase}
							placeholder="Encrypt the tokens in the file"
						/>
						{#if credentials === BundleCredentials.Plain}
							<p class="flex items-start gap-1.5 text-xs text-destructive">
								<TriangleAlertIcon class="mt-0.5 size-3.5 shrink-0" />
								<span>
									Without a passphrase the tokens are written to the file in
									cleartext. Anyone who opens it can read them.
								</span>
							</p>
						{:else}
							<p class="text-xs text-muted-foreground">
								Tokens are encrypted with AES-GCM. The same passphrase is needed
								to import them, and it cannot be recovered.
							</p>
						{/if}
					</div>
				{/if}
			{/if}
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={cancel}>Cancel</Button>
			<Button onclick={confirm} disabled={transferState.busy}>
				{transferState.busy ? transferState.phase || "Exporting…" : "Export"}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
