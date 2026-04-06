<script lang="ts">
import { CircleAlertIcon, Trash2Icon, XIcon } from "@lucide/svelte";
import type { Readable } from "svelte/store";
import { fly } from "svelte/transition";
import { Button } from "$lib/components/ui/button/index.js";
import * as ErrorService from "$lib/services/error_service.js";

type Props = {
	showErrors: boolean;
	visibleErrors: ErrorService.CollectionError[];
	errorState: Readable<ErrorService.CollectionError[]>;
};

let { showErrors = $bindable(), visibleErrors, errorState }: Props = $props();
</script>

<div
	class="fixed right-4 bottom-20 z-50 w-[min(24rem,calc(100vw-2rem))]"
	transition:fly={{ y: 12, duration: 160 }}
>
	<div
		class="overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl"
	>
		<div
			class="flex items-center justify-between border-b border-border/60 px-4 py-3"
		>
			<div>
				<p class="text-sm font-semibold text-foreground">Errors</p>
				<p class="text-xs text-muted-foreground">
					Error messages collected by the system.
				</p>
			</div>
			<Button
				variant="ghost"
				size="icon-sm"
				onclick={() => (showErrors = false)}
			>
				<XIcon class="size-3.5" />
			</Button>
		</div>

		<div class="max-h-72 overflow-auto p-3">
			{#if visibleErrors.length > 0}
				<div class="space-y-2">
					{#each visibleErrors as error (error.id)}
						<div
							class="rounded-xl border border-border/60 bg-muted/35 p-3"
							transition:fly={{ x: 16, duration: 140 }}
						>
							<div class="flex items-center gap-3">
								<CircleAlertIcon
									class="size-4 shrink-0 self-center text-red-500"
								/>
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium text-foreground">
										{error.message}
									</p>
									<p class="mt-1 text-xs text-muted-foreground">
										{ErrorService.formatErrorTimestamp(error.timestamp)}
									</p>
								</div>
								<Button
									variant="ghost"
									size="icon-sm"
									class="self-center text-red-500 hover:bg-red-500/10 hover:text-red-600"
									onclick={() => ErrorService.removeError(error.id)}
								>
									<Trash2Icon class="size-3.5" />
								</Button>
							</div>
						</div>
					{/each}
				</div>
				{#if $errorState.length > visibleErrors.length}
					<p class="mt-3 px-1 text-xs text-muted-foreground">
						Showing {visibleErrors.length} of {$errorState.length} errors.
					</p>
				{/if}
			{:else}
				<div
					class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 px-4 py-8 text-center"
				>
					<CircleAlertIcon class="size-5 text-muted-foreground" />
					<p class="text-sm font-medium text-foreground">
						No errors registered
					</p>
					<p class="text-xs text-muted-foreground">
						The collection system has not reported any errors yet.
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>
