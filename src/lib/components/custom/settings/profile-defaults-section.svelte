<script lang="ts">
import { CheckIcon } from "@lucide/svelte";
import * as Card from "$lib/components/ui/card/index.js";
import Input from "$lib/components/ui/input/input.svelte";
import * as Select from "$lib/components/ui/select/index.js";
import { SettingsService } from "$lib/services";
import { CollectionType, HttpVersion } from "$lib/types";

const modeOptions: Array<{
	value: CollectionType;
	title: string;
	description: string;
}> = [
	{
		value: CollectionType.Snapshot,
		title: "Snapshot",
		description: "Capture a focused point-in-time profile.",
	},
	{
		value: CollectionType.Stream,
		title: "Stream",
		description: "Continuously follow runtime changes.",
	},
];

const schemeOptions = [
	{ value: "http", label: "http://" },
	{ value: "https", label: "https://" },
] as const;

const httpVersionOptions: Array<{ value: HttpVersion; label: string }> = [
	{ value: HttpVersion.Http2, label: "HTTP/2" },
	{ value: HttpVersion.Http3, label: "HTTP/3" },
];

const settings = SettingsService.settings;

function parseDefaultUrl(url: string): {
	scheme: "http" | "https";
	host: string;
} {
	const m = url.match(/^(https?):\/\/([^/]*)/);
	if (m) return { scheme: m[1] as "http" | "https", host: m[2] };
	return { scheme: "http", host: "" };
}
</script>

<Card.Root class="border-border/60">
	<Card.Header>
		<Card.Title class="text-base">Profile Defaults</Card.Title>
		<Card.Description>
			Pre-filled values when creating a new profile. Changes apply immediately.
		</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		<label class="block">
			<span class="mb-3 block text-sm font-medium text-foreground">
				Default name
				<span class="ml-1 font-normal text-muted-foreground">(optional)</span>
			</span>
			<Input
				value={$settings.defaultName}
				placeholder="Production pprof"
				oninput={(e) =>
                    SettingsService.updateSettings({
                        defaultName: e.currentTarget.value,
                    })}
			/>
		</label>

		<div class="block">
			<span class="mb-3 block text-sm font-medium text-foreground">
				Default URL
				<span class="ml-1 font-normal text-muted-foreground">(optional)</span>
			</span>
			<div class="flex gap-2">
				<Select.Root
					type="single"
					value={parseDefaultUrl($settings.defaultUrl).scheme}
					onValueChange={(v) => {
                        if (!v) return;
                        const host = parseDefaultUrl($settings.defaultUrl).host;
                        SettingsService.updateSettings({
                            defaultUrl: `${v}://${host}`,
                        });
                    }}
				>
					<Select.Trigger class="w-25 shrink-0">
						{schemeOptions.find(
                            (o) =>
                                o.value ===
                                parseDefaultUrl($settings.defaultUrl).scheme,
                        )?.label ?? "http://"}
					</Select.Trigger>
					<Select.Content>
						{#each schemeOptions as opt (opt.value)}
							<Select.Item
								value={opt.value}
								disabled={$settings.defaultHttpVersion ===
                                    HttpVersion.Http3 && opt.value === "http"}
							>
								{opt.label}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<Input
					value={parseDefaultUrl($settings.defaultUrl).host}
					placeholder="localhost:9090"
					class="flex-1 min-w-0"
					oninput={(e) => {
                        const scheme = parseDefaultUrl(
                            $settings.defaultUrl,
                        ).scheme;
                        SettingsService.updateSettings({
                            defaultUrl: `${scheme}://${e.currentTarget.value}`,
                        });
                    }}
				/>
				<Select.Root
					type="single"
					value={$settings.defaultHttpVersion}
					onValueChange={(v) => {
                        if (!v) return;
                        const httpVersion = v as HttpVersion;
                        const { host } = parseDefaultUrl($settings.defaultUrl);
                        const patch: Partial<typeof $settings> = {
                            defaultHttpVersion: httpVersion,
                        };
                        if (httpVersion === HttpVersion.Http3) {
                            patch.defaultUrl = `https://${host}`;
                        }
                        SettingsService.updateSettings(patch);
                    }}
				>
					<Select.Trigger class="w-25 shrink-0">
						{httpVersionOptions.find(
                            (o) => o.value === $settings.defaultHttpVersion,
                        )?.label ?? "HTTP/2"}
					</Select.Trigger>
					<Select.Content>
						{#each httpVersionOptions as opt (opt.value)}
							<Select.Item value={opt.value}>
								{opt.label}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>

		<div>
			<p class="mb-3 text-sm font-medium text-foreground">Collection mode</p>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each modeOptions as option (option.value)}
					{@const isSelected = $settings.defaultMode === option.value}
					<button
						type="button"
						class={`rounded-2xl border p-4 text-left transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border/70 bg-muted/25 hover:border-primary/30"}`}
						onclick={() =>
                            SettingsService.updateSettings({
                                defaultMode: option.value,
                            })}
					>
						<div class="flex items-start justify-between gap-3">
							<div>
								<p class="text-base font-semibold text-foreground">
									{option.title}
								</p>
								<p class="mt-1 text-sm text-muted-foreground">
									{option.description}
								</p>
							</div>
							<div
								class={`flex h-5 w-6 items-center justify-center rounded-full border ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
							>
								{#if isSelected}
									<CheckIcon class="size-3.5" />
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>
		</div>

		{#if $settings.defaultMode === CollectionType.Stream}
			<div class="grid gap-4 sm:grid-cols-2">
				<label class="block">
					<span class="mb-3 block text-sm font-medium text-foreground">
						Interval
						<span class="ml-1 font-normal text-muted-foreground"
							>(seconds)</span
						>
					</span>
					<Input
						type="number"
						min={1}
						step={1}
						value={$settings.defaultIntervalSeconds}
						oninput={(e) => {
                            const v = Number.parseInt(
                                e.currentTarget.value,
                                10,
                            );
                            if (v >= 1)
                                SettingsService.updateSettings({
                                    defaultIntervalSeconds: v,
                                });
                        }}
					/>
				</label>
				<label class="block">
					<span class="mb-3 block text-sm font-medium text-foreground">
						Cycles
						<span class="ml-1 font-normal text-muted-foreground"
							>(0 = infinite)</span
						>
					</span>
					<Input
						type="number"
						min={0}
						step={1}
						value={$settings.defaultNumberOfCycles}
						oninput={(e) => {
                            const v = Number.parseInt(
                                e.currentTarget.value,
                                10,
                            );
                            if (v >= 0)
                                SettingsService.updateSettings({
                                    defaultNumberOfCycles: v,
                                });
                        }}
					/>
				</label>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
