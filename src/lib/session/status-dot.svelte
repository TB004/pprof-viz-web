<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { cn } from "#lib/utils";
import type { SessionTone } from "./status.js";

let { tone, class: className }: { tone: SessionTone; class?: string } =
	$props();
</script>

<span
	aria-hidden="true"
	class={cn(
		"size-2 shrink-0 rounded-full",
		tone === "live" && "bg-ok animate-live-pulse",
		tone === "connecting" && "bg-warn animate-blink",
		tone === "failed" && "bg-bad",
		tone === "stopped" && "bg-muted-foreground",
		tone === "idle" && "bg-faint",
		className,
	)}
></span>
