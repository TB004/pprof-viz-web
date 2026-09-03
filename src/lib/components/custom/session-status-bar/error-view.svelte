<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { CircleAlertIcon, Trash2Icon, XIcon } from "@lucide/svelte";
import { fly } from "svelte/transition";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as ScrollArea from "$lib/components/ui/scroll-area/index.js";
import { errorService, formatErrorTimestamp } from "$lib/services";

type Props = {
	showErrors: boolean;
};

let { showErrors = $bindable() }: Props = $props();

const errorState = errorService.getErrorLog();
</script>

<div
	class="fixed right-4 bottom-20 z-50 w-[min(24rem,calc(100vw-2rem))]"
	transition:fly={{ y: 12, duration: 160 }}
>
	<Card.Root
		class="gap-0 rounded-2xl border border-border/70 bg-popover/95 py-0 text-popover-foreground shadow-2xl ring-0 backdrop-blur-xl"
	>
		<div class="border-b border-border/60">
			<Card.Header class="rounded-t-none px-4 py-3">
				<Card.Title class="text-sm font-semibold">Errors</Card.Title>
				<Card.Description class="text-xs">
					Error messages collected by the system.
				</Card.Description>
				<Card.Action>
					<Button
						variant="ghost"
						class="bg-secondary"
						size="icon-sm"
						onclick={() => (showErrors = false)}
					>
						<XIcon class="size-3.5" />
					</Button>
				</Card.Action>
			</Card.Header>
		</div>

		<Card.Content class="p-3.5 pr-0.5">
			<ScrollArea.Root class="h-72 pr-3">
				{#if errorState.length > 0}
					<div class="space-y-2">
						{#each errorState as error (error.id)}
							<div transition:fly={{ x: 16, duration: 140 }}>
								<Item.Root
									variant="muted"
									size="sm"
									class="rounded-xl border border-border/60 bg-muted/35"
								>
									<Item.Media
										variant="icon"
										class="translate-y-0! self-center! text-red-500"
									>
										<CircleAlertIcon class="size-4" />
									</Item.Media>
									<Item.Content>
										<Item.Title class="line-clamp-none w-full">
											{error.message}
										</Item.Title>
										<Item.Description class="line-clamp-none text-xs">
											{formatErrorTimestamp(
                                                error.timestamp,
                                            )}
										</Item.Description>
									</Item.Content>
									<Item.Actions>
										<Button
											variant="ghost"
											size="icon-sm"
											class="text-red-500 hover:bg-red-500/10 hover:text-red-600"
											onclick={() =>
                                                errorService.removeError(
                                                    error.id,
                                                )}
										>
											<Trash2Icon class="size-3.5" />
										</Button>
									</Item.Actions>
								</Item.Root>
							</div>
						{/each}
					</div>
				{:else}
					<div
						class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 px-4 py-8 text-center h-full"
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
			</ScrollArea.Root>
		</Card.Content>
	</Card.Root>
</div>
