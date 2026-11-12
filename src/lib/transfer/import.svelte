<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { DownloadIcon } from "@lucide/svelte";
import { transferService } from "#lib/app.svelte.js";
import ErrorAlert from "#lib/components/error-alert.svelte";
import Notice from "#lib/components/notice.svelte";
import RadioCard from "#lib/components/radio-card.svelte";
import {
	Button,
	type ButtonSize,
	type ButtonVariant,
} from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import { Task } from "#lib/task.svelte.js";
import { fmtBytes } from "#lib/utils";
import { BundleCredentials } from "./manifest.js";
import { ImportMode } from "./transfer.svelte.js";

// The Import button and the dialog it opens, so every page that offers an
// import reports its failures in the same place: inside the dialog.
let {
	variant = "outline",
	size = "default",
	class: className,
}: {
	variant?: ButtonVariant;
	size?: ButtonSize;
	class?: string;
} = $props();

const uid = $props.id();
const transferState = transferService.getState();
const staged = $derived(transferState.staged);

/** Picking and parsing the files. */
const reading = new Task();
/** Writing the staged import. */
const importing = new Task();

let mode = $state<ImportMode>(ImportMode.Skip);
let passphrase = $state("");

// Every staged file starts the choice over, so a previous import's answer is
// never applied silently to the next one.
$effect(() => {
	if (staged) {
		mode = ImportMode.Skip;
		passphrase = "";
		importing.reset();
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

function choose() {
	void reading.run(() => transferService.stageImport());
}

function close() {
	transferService.clearStaged();
	reading.reset();
	importing.reset();
}

async function confirm() {
	await importing.run(() =>
		transferService.commitImport(mode, passphrase.trim() || undefined),
	);
}
</script>

<Button
	{variant}
	{size}
	class={className}
	disabled={transferState.busy}
	onclick={choose}
>
	<DownloadIcon />
	Import
</Button>

<Dialog.Root
	bind:open={
		() => staged !== null || reading.error !== null,
		(open) => {
	if (!open) close();
}
	}
>
	<Dialog.Content class="sm:max-w-[540px]">
		<Dialog.Header>
			<Dialog.Title>Import</Dialog.Title>
			<Dialog.Description class={staged ? "mono truncate" : ""}>
				{#if staged}
					{staged.sources.join(", ")}
				{:else}
					The selected files could not be read.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-4 px-[22px] py-3.5">
			<ErrorAlert message={reading.error} />

			{#if staged}
				<dl class="m-0 grid grid-cols-3 gap-2">
					{#each [
						["Projects", staged.projects.length],
						["Profiles", staged.profiles.length],
						["Archives", staged.payloads.length],
					] as entry (entry[0])}
						<div
							class="border-line bg-surface-2 rounded-[10px] border px-3 py-2.5"
						>
							<dt class="text-muted-foreground text-[11.5px]">{entry[0]}</dt>
							<dd class="mono m-0 text-lg font-[550]">{entry[1]}</dd>
						</div>
					{/each}
				</dl>

				<p class="text-muted-foreground text-[12.5px]">
					<span class="mono">{fmtBytes(staged.totalBytes)}</span>
					of archive data.
					{#if staged.orphanCollections.length > 0}
						{staged.orphanCollections.length}
						collection{staged.orphanCollections.length === 1 ? "" : "s"}
						in the manifest carry no payload and will be ignored.
					{/if}
				</p>

				{#if encrypted}
					<div>
						<label
							for="{uid}-passphrase"
							class="mb-2 block text-[13px] font-[550]"
						>
							Passphrase
						</label>
						<Input
							id="{uid}-passphrase"
							type="password"
							autocomplete="current-password"
							bind:value={passphrase}
							placeholder="Leave empty to import without credentials"
							onkeydown={(e) => e.key === "Enter" && confirm()}
						/>
						<p class="text-muted-foreground mt-1.5 text-[12.5px]">
							This bundle carries encrypted profile tokens. Without the
							passphrase the profiles are imported and their tokens left blank.
						</p>
					</div>
				{:else if staged.credentials === BundleCredentials.Plain}
					<Notice tone="warn">
						This bundle carries profile tokens in cleartext.
					</Notice>
				{/if}

				{#if collisions > 0}
					<fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
						<legend class="mb-2 text-[13px] font-[550]">
							{collisions}
							record{collisions === 1 ? "" : "s"}
							already exist here
						</legend>
						<div role="radiogroup" class="flex flex-col gap-2">
							{#each MODES as option (option.value)}
								<RadioCard
									name="{uid}-mode"
									class="px-3 py-[11px]"
									title={option.label}
									description={option.hint}
									checked={mode === option.value}
									onSelect={() => (mode = option.value)}
								/>
							{/each}
						</div>
					</fieldset>
				{/if}

				<ErrorAlert message={importing.error} />
			{/if}
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={close} disabled={transferState.busy}>
				Cancel
			</Button>
			{#if staged}
				<Button onclick={confirm} disabled={transferState.busy}>
					<DownloadIcon />
					{transferState.busy ? transferState.phase || "Importing…" : "Import"}
				</Button>
			{:else}
				<Button onclick={choose} disabled={transferState.busy}>
					{transferState.busy
						? transferState.phase || "Reading…"
						: "Choose other files"}
				</Button>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
