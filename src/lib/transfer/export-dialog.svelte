<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { LockIcon, UploadIcon } from "@lucide/svelte";
import { transferService } from "#lib/app.svelte.js";
import ErrorAlert from "#lib/components/error-alert.svelte";
import Notice from "#lib/components/notice.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { Checkbox } from "#lib/components/ui/checkbox/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import { Task } from "#lib/task.svelte.js";
import { BundleCredentials } from "./manifest.js";
import type { ExportOptions, ExportScope } from "./transfer.svelte.js";

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
const exporting = new Task();

let includeArchives = $state(true);
let includeCredentials = $state(false);
let passphrase = $state("");

// A fresh dialog always starts from the safe defaults, whatever the last one
// was left on.
$effect(() => {
	if (open) {
		exporting.reset();
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
	const ok = await exporting.run(() =>
		transferService.exportBundle(exportScope, options, suggestedName),
	);
	if (ok) open = false;
}
</script>

{#snippet option(id: string, title: string, hint: string)}
	<span>
		<label for={id} class="block cursor-pointer text-[13.5px] font-semibold">
			{title}
		</label>
		<span class="text-muted-foreground mt-0.5 block text-[12.5px]">{hint}</span>
	</span>
{/snippet}

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{subtitle}</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-4 px-[22px] py-3.5">
			{#if canIncludeArchives}
				<div class="flex items-start gap-3">
					<Checkbox
						id="{uid}-archives"
						class="mt-0.5"
						bind:checked={includeArchives}
					/>
					{@render option(
						`${uid}-archives`,
						"Include saved collections",
						"Archives have no link back to a profile, so they are matched by the profile name and URL they were captured with.",
					)}
				</div>
			{/if}

			{#if profileCount > 0}
				<div class="flex items-start gap-3">
					<Checkbox
						id="{uid}-credentials"
						class="mt-0.5"
						bind:checked={includeCredentials}
					/>
					{@render option(
						`${uid}-credentials`,
						"Include profile tokens",
						"Off by default. Imported profiles otherwise ask for their credentials again.",
					)}
				</div>

				{#if includeCredentials}
					<div class="flex flex-col gap-2 pl-7">
						<label for="{uid}-passphrase" class="text-[13px] font-[550]">
							Passphrase
							<span class="text-muted-foreground ml-1 font-normal"
								>optional</span
							>
						</label>
						<Input
							id="{uid}-passphrase"
							type="password"
							autocomplete="new-password"
							bind:value={passphrase}
							placeholder="Encrypt the tokens in the file"
						/>
						{#if credentials === BundleCredentials.Plain}
							<Notice tone="bad">
								Without a passphrase the tokens are written to the file in
								cleartext. Anyone who opens it can read them.
							</Notice>
						{:else}
							<Notice tone="ok" icon={LockIcon}>
								Tokens are encrypted with AES-GCM. The same passphrase is needed
								to import them, and it cannot be recovered.
							</Notice>
						{/if}
					</div>
				{/if}
			{/if}

			<ErrorAlert message={exporting.error} />
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={cancel}>Cancel</Button>
			<Button onclick={confirm} disabled={transferState.busy}>
				<UploadIcon />
				{transferState.busy
					? transferState.phase || "Exporting…"
					: "Export .ppvzb"}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
