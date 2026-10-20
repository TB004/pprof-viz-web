<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { TriangleAlertIcon } from "@lucide/svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import { transferService } from "#lib/services";
import { BundleCredentials, ImportMode } from "#lib/types";
import { FormatUtils } from "#lib/utils";

const uid = $props.id();
const transferState = transferService.getState();
const staged = $derived(transferState.staged);

let mode = $state<ImportMode>(ImportMode.Skip);
let passphrase = $state("");

// Every staged file starts the choice over, so a previous import's answer is
// never applied silently to the next one.
$effect(() => {
	if (staged) {
		mode = ImportMode.Skip;
		passphrase = "";
	}
});

const collisions = $derived(
	staged
		? staged.collisions.projects +
				staged.collisions.profiles +
				staged.collisions.collections
		: 0,
);

const encrypted = $derived(staged?.credentials === BundleCredentials.Encrypted);

const MODES: { value: ImportMode; label: string; hint: string }[] = [
	{
		value: ImportMode.Skip,
		label: "Skip existing",
		hint: "Keep what is here and add only what is new.",
	},
	{
		value: ImportMode.Copy,
		label: "Import as copies",
		hint: "Add everything again under new identifiers.",
	},
	{
		value: ImportMode.Replace,
		label: "Replace existing",
		hint: "Overwrite the local records the file also carries.",
	},
];

function close() {
	transferService.clearStaged();
}

async function confirm() {
	await transferService.commitImport(mode, passphrase.trim() || undefined);
}
</script>

<Dialog.Root
	bind:open={
		() => staged !== null,
		(open) => {
	if (!open) close();
}
	}
>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Import</Dialog.Title>
			<Dialog.Description>
				{#if staged}
					{staged.sources.join(", ")}
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		{#if staged}
			<div class="flex flex-col gap-4">
				<dl class="grid grid-cols-3 gap-3 text-sm">
					{#each [
						["Projects", staged.projects.length],
						["Profiles", staged.profiles.length],
						["Archives", staged.payloads.length],
					] as entry (entry[0])}
						<div class="rounded-md border bg-muted/30 px-3 py-2">
							<dt class="text-xs text-muted-foreground">{entry[0]}</dt>
							<dd class="text-base font-medium tabular-nums">{entry[1]}</dd>
						</div>
					{/each}
				</dl>

				<p class="text-xs text-muted-foreground">
					{FormatUtils.fmtBytes(staged.totalBytes)}
					of archive data.
					{#if staged.orphanCollections.length > 0}
						{staged.orphanCollections.length}
						collection{staged.orphanCollections.length === 1 ? "" : "s"}
						in the manifest carry no payload and will be ignored.
					{/if}
				</p>

				{#if encrypted}
					<div class="flex flex-col gap-2">
						<label for="{uid}-passphrase" class="text-sm font-medium">
							Passphrase
						</label>
						<Input
							id="{uid}-passphrase"
							type="password"
							autocomplete="current-password"
							bind:value={passphrase}
							placeholder="Leave empty to import without credentials"
						/>
						<p class="text-xs text-muted-foreground">
							This bundle carries encrypted profile tokens. Without the
							passphrase the profiles are imported and their tokens left blank.
						</p>
					</div>
				{:else if staged.credentials === BundleCredentials.Plain}
					<p class="flex items-start gap-1.5 text-xs text-muted-foreground">
						<TriangleAlertIcon class="mt-0.5 size-3.5 shrink-0" />
						<span>This bundle carries profile tokens in cleartext.</span>
					</p>
				{/if}

				{#if collisions > 0}
					<fieldset class="flex flex-col gap-2">
						<legend class="mb-3 text-sm font-medium">
							{collisions}
							record{collisions === 1 ? "" : "s"}
							already exist here
						</legend>
						{#each MODES as option (option.value)}
							<label class="flex items-start gap-2.5 text-sm">
								<input
									type="radio"
									name="{uid}-mode"
									class="mt-0.5 size-4 accent-primary"
									value={option.value}
									bind:group={mode}
								>
								<span>
									{option.label}
									<span class="block text-xs text-muted-foreground">
										{option.hint}
									</span>
								</span>
							</label>
						{/each}
					</fieldset>
				{/if}
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={close} disabled={transferState.busy}>
				Cancel
			</Button>
			<Button onclick={confirm} disabled={transferState.busy}>
				{transferState.busy ? transferState.phase || "Importing…" : "Import"}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
