// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { type Readable, writable } from "svelte/store";
import { browser } from "$app/environment";
import * as Ipc from "$lib/ipc";
import {
	type AppSettings,
	CollectionType,
	HttpVersion,
	ThemeMode,
} from "$lib/types";

const THEME_CACHE_KEY = "pprof-viz-settings";

const fallbackSettings: AppSettings = {
	theme: ThemeMode.System,
	defaultName: "",
	defaultUrl: "",
	defaultMode: CollectionType.Stream,
	defaultIntervalSeconds: 1,
	defaultNumberOfCycles: 0,
	defaultHttpVersion: HttpVersion.Http2,
};

const settingsStore = writable<AppSettings>(fallbackSettings);

export const settings: Readable<AppSettings> = {
	subscribe: settingsStore.subscribe,
};

let hydrated = false;

function applyTheme(theme: ThemeMode) {
	const isDark =
		theme === ThemeMode.Dark ||
		(theme === ThemeMode.System &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);
	document.documentElement.classList.toggle("dark", isDark);
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

async function ensureHydrated() {
	if (hydrated) return;
	hydrated = true;
	try {
		const loaded = await Ipc.getSettings();
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
		cacheThemeForBoot(s.theme);
	});
	void ensureHydrated();
}

export async function updateSettings(patch: Partial<AppSettings>) {
	const current = getSettingsSnapshot();
	const merged = { ...current, ...patch };
	const updated = await Ipc.updateSettings(merged);
	settingsStore.set(updated);
}

export function getSettingsSnapshot(): AppSettings {
	let snapshot = fallbackSettings;
	const unsubscribe = settings.subscribe((value) => {
		snapshot = value;
	});
	unsubscribe();
	return snapshot;
}
