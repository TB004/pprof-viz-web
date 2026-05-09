import { invoke } from "@tauri-apps/api/core";
import { type Readable, writable } from "svelte/store";
import { browser } from "$app/environment";
import type { AppSettings, ThemeMode } from "$lib/types";

const THEME_CACHE_KEY = "pprof-viz-settings";

const fallbackSettings: AppSettings = {
	theme: "system",
	defaultName: "",
	defaultUrl: "",
	defaultMode: "stream",
	defaultIntervalSeconds: 1,
	defaultNumberOfCycles: 0,
};

function applyTheme(theme: ThemeMode) {
	const isDark =
		theme === "dark" ||
		(theme === "system" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);
	document.documentElement.classList.toggle("dark", isDark);
}

let systemMediaCleanup: (() => void) | undefined;

function syncSystemWatcher(theme: ThemeMode) {
	systemMediaCleanup?.();
	systemMediaCleanup = undefined;

	if (theme !== "system") return;

	const mq = window.matchMedia("(prefers-color-scheme: dark)");
	const handler = () => applyTheme("system");
	mq.addEventListener("change", handler);
	systemMediaCleanup = () => mq.removeEventListener("change", handler);
}

// Mirror only the theme to localStorage so the inline script in `app.html`
// can avoid a flash of the wrong theme on cold start. Rust remains the
// source of truth for everything else.
function cacheThemeForBoot(theme: ThemeMode) {
	try {
		localStorage.setItem(THEME_CACHE_KEY, JSON.stringify({ theme }));
	} catch {
		// quota / private mode — ignore
	}
}

const settingsStore = writable<AppSettings>(fallbackSettings);

let hydrated = false;

async function ensureHydrated() {
	if (hydrated) return;
	hydrated = true;
	try {
		const loaded = await invoke<AppSettings>("get_settings");
		settingsStore.set(loaded);
	} catch {
		// Leave fallback in place — Rust may not be ready yet during very
		// early boot. We'll re-hydrate next time updateSettings is called.
		hydrated = false;
	}
}

if (browser) {
	settingsStore.subscribe((s) => {
		applyTheme(s.theme);
		syncSystemWatcher(s.theme);
		cacheThemeForBoot(s.theme);
	});
	void ensureHydrated();
}

export const settings: Readable<AppSettings> = {
	subscribe: settingsStore.subscribe,
};

export async function updateSettings(patch: Partial<AppSettings>) {
	const updated = await invoke<AppSettings>("update_settings", { patch });
	settingsStore.set(updated);
}

export function getSettingsSnapshot(): AppSettings {
	let snapshot = fallbackSettings;
	const unsubscribe = settingsStore.subscribe((value) => {
		snapshot = value;
	});
	unsubscribe();
	return snapshot;
}
