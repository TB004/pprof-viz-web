<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import Input from "$lib/components/ui/input/input.svelte";
import * as Select from "$lib/components/ui/select/index.js";
import { HttpVersion } from "$lib/types";
import { httpVersionOptions, type Scheme, schemeOptions } from "./options.js";

type Props = {
	scheme: Scheme;
	host: string;
	httpVersion: HttpVersion;
	onSchemeChange: (scheme: Scheme) => void;
	onHostChange: (host: string) => void;
	onHttpVersionChange: (httpVersion: HttpVersion) => void;
	label?: string;
	optional?: boolean;
};

let {
	scheme,
	host,
	httpVersion,
	onSchemeChange,
	onHostChange,
	onHttpVersionChange,
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
					<Select.Item
						value={opt.value}
						disabled={httpVersion === HttpVersion.Http3 &&
							opt.value === "http"}
					>
						{opt.label}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
		<Input
			value={host}
			placeholder="localhost:9090"
			class="flex-1 min-w-0"
			oninput={(e) => onHostChange(e.currentTarget.value)}
		/>
		<Select.Root
			type="single"
			value={httpVersion}
			onValueChange={(v) => {
				if (v) onHttpVersionChange(v as HttpVersion);
			}}
		>
			<Select.Trigger class="w-25 shrink-0">
				{httpVersionOptions.find((o) => o.value === httpVersion)?.label ??
					"HTTP/2"}
			</Select.Trigger>
			<Select.Content class="p-1.5">
				{#each httpVersionOptions as opt (opt.value)}
					<Select.Item value={opt.value}>
						{opt.label}
						{#if opt.requiresHttps}
							<span class="ml-1 text-xs text-muted-foreground">(https)</span>
						{/if}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
</div>
