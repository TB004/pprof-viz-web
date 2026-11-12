<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import type { Snippet } from "svelte";
import ErrorAlert from "#lib/components/error-alert.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import { Input } from "#lib/components/ui/input/index.js";

type Props = {
	open: boolean;
	/** Dialog heading and blurb — distinct from the `description` field below. */
	title: string;
	subtitle: string;
	name: string;
	description: string;
	onConfirm: () => unknown;
	namePlaceholder?: string;
	descriptionPlaceholder?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	/** Disables the form and swaps in `pendingLabel` while true. */
	pending?: boolean;
	pendingLabel?: string;
	/** Why the last confirm failed, shown under the fields. */
	error?: string | null;
	/** Shown above the fields, e.g. what is about to be saved. */
	summary?: Snippet;
};

let {
	open = $bindable(),
	title,
	subtitle,
	name = $bindable(),
	description = $bindable(),
	onConfirm,
	namePlaceholder,
	descriptionPlaceholder,
	confirmLabel = "Save",
	cancelLabel = "Cancel",
	pending = false,
	pendingLabel = "Saving…",
	error,
	summary,
}: Props = $props();

// Both fields are labelled, so the ids have to be unique per instance.
const uid = $props.id();

function cancel() {
	open = false;
}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{subtitle}</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-4 px-[22px] py-3.5">
			{@render summary?.()}
			<div>
				<label for="{uid}-name" class="mb-2 block text-[13px] font-[550]">
					Name
				</label>
				<Input
					id="{uid}-name"
					bind:value={name}
					placeholder={namePlaceholder}
					onkeydown={(e) => e.key === "Enter" && onConfirm()}
				/>
			</div>
			<div>
				<label
					for="{uid}-description"
					class="mb-2 block text-[13px] font-[550]"
				>
					Description
					<span class="text-muted-foreground ml-1 font-normal">optional</span>
				</label>
				<textarea
					id="{uid}-description"
					bind:value={description}
					placeholder={descriptionPlaceholder}
					class="bg-field border-line-2 text-ink placeholder:text-faint min-h-21 w-full resize-y rounded-control border px-3 py-2.5 text-[13.5px] leading-normal outline-none focus-visible:border-transparent focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-(--focus)"
				></textarea>
			</div>
			<ErrorAlert message={error} />
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={cancel}>
				{cancelLabel}
			</Button>
			<Button onclick={onConfirm} disabled={!name.trim() || pending}>
				{pending ? pendingLabel : confirmLabel}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
