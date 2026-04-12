<script lang="ts">
import { FolderPlusIcon } from "@lucide/svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { ProfileService } from "$lib/services";
import PMSidebarElem from "./pm-sidebar-elem.svelte";
import { dialogState } from "./state.svelte";
import { ScrollArea } from "$lib/components/ui/scroll-area";

const profileCatalog = ProfileService.profileCatalog;
const profileProjects = ProfileService.profileProjects;

function openCreateProjectDialog() {
	dialogState.projectDialogMode = "create";
	dialogState.projectDialogProjectId = undefined;
	dialogState.projectDialogOpen = true;
}
</script>

<aside class="flex min-h-0 flex-col border-r border-border/60 bg-muted/20">
	<div
		class="flex items-center justify-between border-b border-border/60 px-4 py-4"
	>
		<div>
			<p class="text-sm font-semibold text-foreground">Projects</p>
			<p class="text-xs text-muted-foreground">
				View all of your projects and profiles.
			</p>
		</div>
		<Button variant="ghost" size="icon-sm" onclick={openCreateProjectDialog}>
			<FolderPlusIcon class="size-4" />
			<span class="sr-only">Add project</span>
		</Button>
	</div>

	<ScrollArea class="min-h-0 flex-1">
		<div class="p-2">
			{#if !$profileCatalog.loaded}
				<div
					class="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground"
				>
					Loading profiles...
				</div>
			{:else if $profileProjects.length === 0}
				<div
					class="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground"
				>
					No projects yet. Add one to start organizing profiles.
				</div>
			{:else}
				<div class="space-y-1">
					{#each $profileProjects as project (project.id)}
						<PMSidebarElem {project} />
					{/each}
				</div>
			{/if}
		</div>
	</ScrollArea>
</aside>