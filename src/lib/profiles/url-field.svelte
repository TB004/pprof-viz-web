<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts" module>
export type Scheme = "http" | "https";

const schemeOptions: Array<{ value: Scheme; label: string }> = [
	{ value: "http", label: "http://" },
	{ value: "https", label: "https://" },
];

/** Split a stored URL into the parts the URL field edits. */
export function splitUrl(url: string): { scheme: Scheme; host: string } {
	// Tolerates a scheme-only value like "https://", which `new URL` rejects.
	const m = url.match(/^(https?):\/\/([^/]*)/);
	if (m) return { scheme: m[1] as Scheme, host: m[2] };
	return { scheme: "http", host: "" };
}

/** Inverse of {@link splitUrl}. */
export function buildUrl(scheme: Scheme, host: string): string {
	return `${scheme}://${host.trim()}`;
}
</script>

<script lang="ts">
import Input from "#lib/components/ui/input/input.svelte";
import * as Select from "#lib/components/ui/select/index.js";

type Props = {
	scheme: Scheme;
	host: string;
	onSchemeChange: (scheme: Scheme) => void;
	onHostChange: (host: string) => void;
	label?: string;
	optional?: boolean;
};

let {
	scheme,
	host,
	onSchemeChange,
	onHostChange,
	label = "URL",
	optional = false,
}: Props = $props();
</script>

<div class="block">
	<span class="mb-3 block text-sm font-medium text-foreground">
		{label}
		{#if optional}
			<span class="ml-1 font-normal text-muted-foreground">(optional)</span>
		{/if}
	</span>
	<div class="flex gap-2">
		<Select.Root
			type="single"
			value={scheme}
			onValueChange={(v) => {
				if (v) onSchemeChange(v as Scheme);
			}}
		>
			<Select.Trigger class="w-25 shrink-0">
				{schemeOptions.find((o) => o.value === scheme)?.label ?? "http://"}
			</Select.Trigger>
			<Select.Content class="p-1.5">
				{#each schemeOptions as opt (opt.value)}
					<Select.Item value={opt.value}>{opt.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
		<Input
			value={host}
			placeholder="localhost:9090"
			class="flex-1 min-w-0"
			oninput={(e) => onHostChange(e.currentTarget.value)}
		/>
	</div>
</div>
