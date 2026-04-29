import { type Readable, writable } from "svelte/store";
import { browser } from "$app/environment";
import { CollectionType } from "./profile_service.js";

export type ThemeMode = "light" | "dark" | "system";

export interface AppSettings {
	theme: ThemeMode;
	defaultName: string;
	defaultUrl: string;
	defaultMode: CollectionType;
	defaultIntervalSeconds: number;
	defaultNumberOfCycles: number;
}

const SETTINGS_KEY = "pprof-viz-settings";

const fallbackSettings: AppSettings = {
	theme: "system",
	defaultName: "",
	defaultUrl: "",
	defaultMode: CollectionType.Stream,
	defaultIntervalSeconds: 1,
	defaultNumberOfCycles: 0,
};

function loadSettings(): AppSettings {
	if (!browser) return fallbackSettings;
	try {
		const stored = localStorage.getItem(SETTINGS_KEY);
		if (stored) {
			return { ...fallbackSettings, ...JSON.parse(stored) };
		}
	} catch {
		// ignore
	}
	return fallbackSettings;
}

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

const settingsStore = writable<AppSettings>(loadSettings());

if (browser) {
	settingsStore.subscribe((s) => {
		applyTheme(s.theme);
		syncSystemWatcher(s.theme);
	});
}

export const settings: Readable<AppSettings> = {
	subscribe: settingsStore.subscribe,
};

export function updateSettings(patch: Partial<AppSettings>) {
	settingsStore.update((current) => {
		const updated = { ...current, ...patch };
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
		return updated;
	});
}

export function getSettingsSnapshot(): AppSettings {
	let snapshot = fallbackSettings;
	const unsubscribe = settingsStore.subscribe((value) => {
		snapshot = value;
	});
	unsubscribe();
	return snapshot;
}
