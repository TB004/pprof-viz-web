<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { FolderPlusIcon } from "@lucide/svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { ScrollArea } from "#lib/components/ui/scroll-area";
import { profileService } from "#lib/services";
import PMSidebarElem from "./pm-sidebar-elem.svelte";
import { dialogState } from "./state.svelte";

const profileCatalog = profileService.getCatalog();

function openCreateProjectDialog() {
	dialogState.projectDialogMode = "create";
	dialogState.projectDialogProjectId = undefined;
	dialogState.projectDialogOpen = true;
}
</script>

<aside
	class="flex min-h-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
>
	<div
		class="flex items-center justify-between border-b border-sidebar-border px-4 py-4"
	>
		<div>
			<p class="text-sm font-semibold text-sidebar-foreground">Projects</p>
			<p class="text-xs text-sidebar-foreground/60">
				View all of your projects and profiles.
			</p>
		</div>
		<Button
			variant="ghost"
			size="icon-sm"
			class="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
			onclick={openCreateProjectDialog}
		>
			<FolderPlusIcon class="size-4" />
			<span class="sr-only">Add project</span>
		</Button>
	</div>

	<ScrollArea class="min-h-0 flex-1">
		<div class="p-2">
			{#if !profileCatalog.loaded}
				<div
					class="rounded-xl border border-dashed border-sidebar-border p-4 text-sm text-sidebar-foreground/60"
				>
					Loading profiles...
				</div>
			{:else if profileCatalog.projects.length === 0}
				<div
					class="rounded-xl border border-dashed border-sidebar-border p-4 text-sm text-sidebar-foreground/60"
				>
					No projects yet. Add one to start organizing profiles.
				</div>
			{:else}
				<div class="space-y-1">
					{#each profileCatalog.projects as project (project.id)}
						<PMSidebarElem {project} />
					{/each}
				</div>
			{/if}
		</div>
	</ScrollArea>
</aside>
