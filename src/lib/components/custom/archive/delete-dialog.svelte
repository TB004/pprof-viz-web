<script lang="ts">
import { Button } from "$lib/components/ui/button";
import * as Dialog from "$lib/components/ui/dialog";
import { ArchiveService } from "$lib/services";
import type { CollectionRow } from "$lib/types";

let { target = $bindable(null) }: { target: CollectionRow | null } = $props();

async function confirmDelete() {
	if (!target) return;
	await ArchiveService.remove(target.id);
	target = null;
}
</script>

<Dialog.Root
	open={target !== null}
	onOpenChange={(open) => {
		if (!open) target = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete collection</Dialog.Title>
			<Dialog.Description>
				Delete {target?.name} and its .ppvz file. This cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-wrap justify-end gap-2 px-6">
			<Button variant="outline" onclick={() => (target = null)}>Cancel</Button>
			<Button variant="destructive" onclick={confirmDelete}>Delete</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
