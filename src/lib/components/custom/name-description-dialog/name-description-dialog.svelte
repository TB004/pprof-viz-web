<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { Input } from "$lib/components/ui/input/index.js";

type Props = {
	open: boolean;
	/** Dialog heading and blurb — distinct from the `description` field below. */
	title: string;
	subtitle: string;
	name: string;
	description: string;
	onConfirm: () => void | Promise<void>;
	namePlaceholder?: string;
	descriptionPlaceholder?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	/** Disables the form and swaps in `pendingLabel` while true. */
	pending?: boolean;
	pendingLabel?: string;
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
}: Props = $props();

// Both fields are labelled, so the ids have to be unique per instance.
const uid = $props.id();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{subtitle}</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-3">
			<div class="flex flex-col gap-1.5">
				<label for="{uid}-name" class="text-sm font-medium">Name</label>
				<Input
					id="{uid}-name"
					bind:value={name}
					placeholder={namePlaceholder}
					onkeydown={(e) => e.key === "Enter" && onConfirm()}
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<label for="{uid}-description" class="text-sm font-medium">
					Description <span class="text-muted-foreground">(optional)</span>
				</label>
				<Input
					id="{uid}-description"
					bind:value={description}
					placeholder={descriptionPlaceholder}
				/>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>
				{cancelLabel}
			</Button>
			<Button onclick={onConfirm} disabled={!name.trim() || pending}>
				{pending ? pendingLabel : confirmLabel}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
