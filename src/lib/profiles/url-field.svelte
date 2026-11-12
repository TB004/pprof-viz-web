<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts" module>
export type Scheme = "http" | "https";

const schemeOptions: Array<{ value: Scheme; label: string }> = [
	{ value: "https", label: "https://" },
	{ value: "http", label: "http://" },
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
import Notice from "#lib/components/notice.svelte";
import Input from "#lib/components/ui/input/input.svelte";

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
	label = "Collector URL",
	optional = false,
}: Props = $props();

const uid = $props.id();

// Browsers block plain HTTP from an HTTPS page, except for loopback.
const mixedContent = $derived(
	scheme === "http" &&
		host.trim() !== "" &&
		!/^(localhost|127\.|\[::1\])/.test(host.trim()),
);
</script>

<div>
	<label for="{uid}-host" class="mb-2 block text-[13px] font-[550]">
		{label}
		{#if optional}
			<span class="text-muted-foreground ml-1 font-normal">optional</span>
		{/if}
	</label>
	<div class="flex">
		<fieldset
			class="m-0 border-line bg-hover inline-flex shrink-0 gap-0.5 rounded-l-control border border-r-0 p-1"
		>
			<legend class="sr-only">Scheme</legend>
			{#each schemeOptions as opt (opt.value)}
				<button
					type="button"
					aria-pressed={scheme === opt.value}
					class="mono text-muted-foreground hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink h-7 cursor-pointer rounded-[7px] px-2 text-xs aria-pressed:shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
					onclick={() => onSchemeChange(opt.value)}
				>
					{opt.label}
				</button>
			{/each}
		</fieldset>
		<Input
			id="{uid}-host"
			value={host}
			placeholder="collector.internal:9090"
			class="mono min-w-0 flex-1 rounded-l-none"
			oninput={(e) => onHostChange(e.currentTarget.value)}
		/>
	</div>
	{#if mixedContent}
		<Notice tone="warn" class="mt-2">
			An HTTPS-hosted dashboard can’t reach an http:// collector (mixed
			content). Plain HTTP only works for localhost.
		</Notice>
	{/if}
</div>
