<script lang="ts">
import {
	AlertCircleIcon,
	CheckCircle2Icon,
	CheckIcon,
	DownloadCloudIcon,
	LoaderCircleIcon,
	MonitorIcon,
	MoonIcon,
	RefreshCwIcon,
	SunIcon,
	TriangleAlertIcon,
} from "@lucide/svelte";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { arch } from "@tauri-apps/plugin-os";
import { onMount } from "svelte";
import type { UpdateStatus } from "$lib/bindings";
import { commands } from "$lib/bindings";
import * as Card from "$lib/components/ui/card/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import Input from "$lib/components/ui/input/input.svelte";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import * as Tooltip from "$lib/components/ui/tooltip/index.js";
import { SettingsService } from "$lib/services";
import { run } from "$lib/services/invoke.js";
import { CollectionType, ThemeMode } from "$lib/types";

const themeOptions: Array<{
	value: ThemeMode;
	label: string;
	icon: typeof MonitorIcon;
}> = [
	{ value: ThemeMode.System, label: "System", icon: MonitorIcon },
	{ value: ThemeMode.Light, label: "Light", icon: SunIcon },
	{ value: ThemeMode.Dark, label: "Dark", icon: MoonIcon },
];

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

const settings = SettingsService.settings;

let version = $state(new Promise(() => "-"));
let architecture = $state("-");

let resetDialogOpen = $state(false);
let resetting = $state(false);

type UpdateState =
	| { phase: "idle" }
	| { phase: "checking" }
	| { phase: "error"; message: string }
	| { phase: "up-to-date"; currentVersion: string }
	| { phase: "available"; status: UpdateStatus }
	| { phase: "downloading" };

let updateState = $state<UpdateState>({ phase: "idle" });

onMount(() => {
	version = getVersion();
	architecture = arch();
	void checkForUpdates();
});

async function checkForUpdates() {
	updateState = { phase: "checking" };
	try {
		const status = await run(commands.checkUpdate());
		if (status.available) {
			updateState = { phase: "available", status };
		} else {
			updateState = {
				phase: "up-to-date",
				currentVersion: status.currentVersion,
			};
		}
	} catch (e) {
		updateState = { phase: "error", message: String(e) };
	}
}

async function installUpdate(status: UpdateStatus) {
	updateState = { phase: "downloading" };
	try {
		await run(
			commands.installUpdate(status.assetUrl ?? "", status.assetFilename ?? ""),
		);
	} catch (e) {
		updateState = { phase: "error", message: String(e) };
	}
}

async function resetAllData() {
	resetting = true;
	try {
		await run(commands.resetAllData());
		// Clear the theme cache so app.html reboots with defaults
		try {
			localStorage.removeItem("pprof-viz-settings");
		} catch {}
		window.location.reload();
	} finally {
		resetting = false;
	}
}

const licenseText = `MIT License

Copyright (c) 2026 Tizian Bahr

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
</script>

<ScrollArea class="h-full mr-2">
	<div class="mx-auto max-w-2xl space-y-8 px-6 py-10">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Settings</h1>
			<p class="mt-1.5 text-sm text-muted-foreground">
				Customize the application to your preferences.
			</p>
		</div>

		<!-- Appearance -->
		<Card.Root class="border-border/60">
			<Card.Header>
				<Card.Title class="text-base">Appearance</Card.Title>
				<Card.Description
					>Choose how pprof-viz looks on your device.</Card.Description
				>
			</Card.Header>
			<Card.Content>
				<div>
					<p class="mb-3 text-sm font-medium text-foreground">Theme</p>
					<div class="grid grid-cols-3 gap-3">
						{#each themeOptions as option (option.value)}
							{@const isSelected =
                                $settings.theme === option.value}
							<button
								type="button"
								class={`relative flex flex-col items-center gap-3 rounded-xl border p-4 text-sm font-medium transition-colors ${isSelected ? "border-primary bg-primary/5 text-foreground" : "border-border/70 bg-muted/25 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
								onclick={() =>
                                    SettingsService.updateSettings({
                                        theme: option.value,
                                    })}
							>
								<option.icon class="size-5" />
								<span>{option.label}</span>
								{#if isSelected}
									<div
										class="absolute right-2.5 top-2.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
									>
										<CheckIcon class="size-2.5" />
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Profile Defaults -->
		<Card.Root class="border-border/60">
			<Card.Header>
				<Card.Title class="text-base">Profile Defaults</Card.Title>
				<Card.Description>
					Pre-filled values when creating a new profile. Changes apply
					immediately.
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-6">
				<label class="block">
					<span class="mb-3 block text-sm font-medium text-foreground">
						Default name
						<span class="ml-1 font-normal text-muted-foreground"
							>(optional)</span
						>
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

				<label class="block">
					<span class="mb-3 block text-sm font-medium text-foreground">
						Default URL
						<span class="ml-1 font-normal text-muted-foreground"
							>(optional)</span
						>
					</span>
					<Input
						value={$settings.defaultUrl}
						placeholder="http://localhost:9090"
						oninput={(e) =>
                            SettingsService.updateSettings({
                                defaultUrl: e.currentTarget.value,
                            })}
					/>
				</label>

				<div>
					<p class="mb-3 text-sm font-medium text-foreground">
						Collection mode
					</p>
					<div class="grid gap-3 sm:grid-cols-2">
						{#each modeOptions as option (option.value)}
							{@const isSelected =
                                $settings.defaultMode === option.value}
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
		<!-- Danger Zone -->
		<Card.Root class="border-destructive/50">
			<Card.Header>
				<Card.Title class="text-base text-destructive">Danger Zone</Card.Title>
				<Card.Description>
					These actions are irreversible. Proceed with caution.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm font-medium text-foreground">Delete all data</p>
						<p class="mt-0.5 text-sm text-muted-foreground">
							Permanently removes all projects, profiles, and resets settings to
							defaults.
						</p>
					</div>
					<button
						type="button"
						class="shrink-0 inline-flex h-9 items-center gap-2 rounded-md border border-destructive/60 bg-destructive/10 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/40 hover:text-destructive-foreground"
						onclick={() => (resetDialogOpen = true)}
					>
						<TriangleAlertIcon class="size-4" />
						Delete all data
					</button>
				</div>
			</Card.Content>
		</Card.Root>

		<Dialog.Root bind:open={resetDialogOpen}>
			<Dialog.Portal>
				<Dialog.Overlay />
				<Dialog.Content class="max-w-md">
					<Dialog.Header>
						<Dialog.Title>Delete all data?</Dialog.Title>
						<Dialog.Description class="mt-5">
							This will permanently delete all projects and profiles, and reset
							all settings to their defaults. This action cannot be undone.
						</Dialog.Description>
					</Dialog.Header>
					<Dialog.Footer class="mt-4 flex justify-end gap-3">
						<Dialog.Close
							class="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
						>
							Cancel
						</Dialog.Close>
						<button
							type="button"
							disabled={resetting}
							class="inline-flex h-9 items-center justify-center rounded-md bg-destructive/70 px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/80 disabled:opacity-50"
							onclick={resetAllData}
						>
							{resetting ? "Deleting…" : "Delete all data"}
						</button>
					</Dialog.Footer>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>

		<!-- Updates -->
		<Card.Root class="border-border/60">
			<Card.Header>
				<Card.Title class="text-base">Updates</Card.Title>
				<Card.Description>Check for new releases from GitHub.</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if updateState.phase === "checking"}
					<div class="flex items-center gap-3 text-sm text-muted-foreground">
						<LoaderCircleIcon class="size-4 animate-spin" />
						Checking for updates…
					</div>
				{:else if updateState.phase === "up-to-date"}
					<div class="flex items-center justify-between gap-4">
						<div class="flex items-center gap-3 text-sm">
							<CheckCircle2Icon class="size-4 text-green-500" />
							<span>
								You're on the latest version
								<span class="ml-1 font-mono text-muted-foreground"
									>({updateState.currentVersion})</span
								>.
							</span>
						</div>
						<button
							type="button"
							class="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
							onclick={checkForUpdates}
						>
							<RefreshCwIcon class="size-3.5" />
							Check again
						</button>
					</div>
				{:else if updateState.phase === "available"}
					{@const s = updateState.status}
					<div class="space-y-4">
						<div class="flex items-start justify-between gap-4">
							<div class="space-y-1">
								<p class="text-sm font-medium">
									Version <span class="font-mono">{s.latestVersion}</span>
									is available
									<span class="ml-1 font-mono text-xs text-muted-foreground"
										>(current: {s.currentVersion})</span
									>
								</p>
								<button
									type="button"
									class="text-xs text-muted-foreground underline-offset-4 underline cursor-pointer"
									onclick={() => openUrl(s.releaseUrl)}
								>
									View release notes
								</button>
							</div>
							<button
								type="button"
								class="shrink-0 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
								onclick={() => installUpdate(s)}
							>
								<DownloadCloudIcon class="size-4" />
								{s.assetUrl
                                    ? "Download & install"
                                    : "Open releases page"}
							</button>
						</div>
					</div>
				{:else if updateState.phase === "downloading"}
					<div class="flex items-center gap-3 text-sm text-muted-foreground">
						<LoaderCircleIcon class="size-4 animate-spin" />
						Downloading update… The app will close when ready.
					</div>
				{:else if updateState.phase === "error"}
					<div class="flex items-center justify-between gap-4">
						<div class="flex items-center gap-3 text-sm">
							<Tooltip.Root>
								<Tooltip.Trigger>
									<AlertCircleIcon class="size-4 text-destructive" />
								</Tooltip.Trigger>
								<Tooltip.Portal>
									<Tooltip.Content class="max-w-xs text-xs">
										{updateState.message}
									</Tooltip.Content>
								</Tooltip.Portal>
							</Tooltip.Root>
							<span class="text-destructive">Failed to check for updates.</span>
						</div>
						<button
							type="button"
							class="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
							onclick={checkForUpdates}
						>
							<RefreshCwIcon class="size-3.5" />
							Retry
						</button>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<!-- About -->
		<Card.Root class="border-border/60">
			<Card.Header>
				<Card.Title class="text-base">About</Card.Title>
				<Card.Description
					>Application information and legal notices.</Card.Description
				>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-y-3 text-sm">
					<span class="text-muted-foreground">Application</span>
					<span class="font-medium">Pprof-Viz</span>
					<span class="text-muted-foreground">Version</span>
					<span class="font-medium font-mono">
						{#await version}
							—
						{:then v}
							{v}
						{/await}
					</span>
					<span class="text-muted-foreground">Architecture</span>
					<span class="font-medium font-mono">{architecture}</span>
					<span class="text-muted-foreground">Identifier</span>
					<span class="font-medium font-mono">de.tb004.pprof-viz</span>
					<span class="text-muted-foreground">Repository</span>
					<span>
						<button
							type="button"
							class="text-sm font-medium text-primary underline-offset-4 hover:underline"
							onclick={() =>
                                openUrl("https://github.com/TB004/pprof-viz")}
						>
							github.com/TB004/pprof-viz
						</button>
					</span>
					<span class="text-muted-foreground">Copyright</span>
					<span class="font-medium">Copyright &copy; 2026 Tizian Bahr</span>
					<span class="text-muted-foreground">License</span>
					<span>
						<Dialog.Root>
							<Dialog.Trigger
								class="text-sm font-medium text-primary underline-offset-4 hover:underline"
							>
								MIT License
							</Dialog.Trigger>
							<Dialog.Portal>
								<Dialog.Overlay />
								<Dialog.Content class="max-w-lg">
									<Dialog.Header>
										<Dialog.Title>MIT License</Dialog.Title>
									</Dialog.Header>
									<ScrollArea
										class="mt-2 max-h-[60vh] rounded-md bg-muted"
										scrollbarYClasses="mr-1"
									>
										<pre
											class="whitespace-pre-wrap p-4 text-xs leading-relaxed text-muted-foreground"
										>{licenseText}</pre>
									</ScrollArea>
								</Dialog.Content>
							</Dialog.Portal>
						</Dialog.Root>
					</span>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</ScrollArea>
