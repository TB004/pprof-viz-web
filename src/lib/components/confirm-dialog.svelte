<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import ErrorAlert from "#lib/components/error-alert.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";

type Props = {
	open: boolean;
	title: string;
	description: string;
	onConfirm: () => unknown;
	confirmLabel?: string;
	cancelLabel?: string;
	/** Disables the confirm button and swaps in `pendingLabel` while true. */
	pending?: boolean;
	pendingLabel?: string;
	/** Why the last confirm failed, shown above the buttons. */
	error?: string | null;
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
	error,
}: Props = $props();

function cancel() {
	open = false;
}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description class="pt-3">{description}</Dialog.Description>
		</Dialog.Header>
		<ErrorAlert message={error} />
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
