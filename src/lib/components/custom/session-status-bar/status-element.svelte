<script lang="ts">
import type { HTMLAttributes } from "svelte/elements";
import type { WithElementRef } from "$lib/utils.js";

let {children}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div class="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 shadow-sm">
    {@render children?.()}
</div>