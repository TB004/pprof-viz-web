<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";

type Props = {
	open: boolean;
	title: string;
	description: string;
	onConfirm: () => void | Promise<void>;
	confirmLabel?: string;
	cancelLabel?: string;
	/** Disables the confirm button and swaps in `pendingLabel` while true. */
	pending?: boolean;
	pendingLabel?: string;
};

let {
	open = $bindable(),
	title,
	description,
	onConfirm,
	confirmLabel = "Delete",
	cancelLabel = "Cancel",
	pending = false,
	pendingLabel,
}: Props = $props();

function cancel() {
	open = false;
}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{description}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={cancel}>
				{cancelLabel}
			</Button>
			<Button variant="destructive" disabled={pending} onclick={onConfirm}>
				{pending && pendingLabel ? pendingLabel : confirmLabel}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
