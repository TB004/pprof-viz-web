// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { browser } from "$app/environment";
import { SettingsIpc } from "$lib/ipc";
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

export const settings: AppSettings = $state({ ...fallbackSettings });

/** Overwrite the live settings in place, keeping the exported identity. */
function apply(next: AppSettings) {
	Object.assign(settings, next);
	applyTheme(next.theme);
	cacheThemeForBoot(next.theme);
}

let hydrated = false;

function applyTheme(theme: ThemeMode) {
	const isDark =
		theme === ThemeMode.Dark ||
		(theme === ThemeMode.System &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);
	document.documentElement.classList.toggle("dark", isDark);
}

// Mirror only the theme to localStorage so the inline script in `app.html`
// can avoid a flash of the wrong theme on cold start.
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
		apply(await SettingsIpc.getSettings());
	} catch {
		// Leave fallback in place — Rust may not be ready yet during very
		// early boot. We'll re-hydrate next time updateSettings is called.
		hydrated = false;
	}
}

if (browser) {
	apply(settings);
	void ensureHydrated();
}

export async function updateSettings(patch: Partial<AppSettings>) {
	apply(await SettingsIpc.updateSettings({ ...settings, ...patch }));
}
