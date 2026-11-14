<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { TrashIcon } from "@lucide/svelte";
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
	<Dialog.Content
		role="alertdialog"
		class="sm:max-w-[440px]"
		showCloseButton={false}
	>
		<div class="flex items-start gap-3 px-[22px] pt-5">
			<div
				class="bg-bad-soft text-bad flex size-10 shrink-0 items-center justify-center rounded-[10px]"
			>
				<TrashIcon class="size-4" />
			</div>
			<Dialog.Header class="p-0">
				<Dialog.Title>{title}</Dialog.Title>
				<Dialog.Description>{description}</Dialog.Description>
			</Dialog.Header>
		</div>
		<ErrorAlert class="mx-[22px] mt-4" message={error} />
		<Dialog.Footer class="pt-[22px]">
			<Button variant="outline" onclick={cancel}>
				{cancelLabel}
			</Button>
			<Button variant="danger" disabled={pending} onclick={onConfirm}>
				{pending && pendingLabel ? pendingLabel : confirmLabel}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
