// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { ALL_STORES, type DBStore } from "#lib/db";
import type { FileStore } from "#lib/files";
import { CollectionType } from "#lib/types";
import { browser } from "$app/env";

/**
 * Settings live in `localStorage`, not IndexedDB, because the inline script in
 * `app.html` reads the theme synchronously before first paint. Both sides use
 * this key.
 */
export const SETTINGS_KEY = "pprof-viz-settings";

export const ThemeMode = {
	Light: "light",
	Dark: "dark",
	System: "system",
} as const;
export type ThemeMode = (typeof ThemeMode)[keyof typeof ThemeMode];

export interface AppSettings {
	theme: ThemeMode;
	defaultName: string;
	defaultUrl: string;
	defaultMode: CollectionType;
	defaultIntervalSeconds: number;
	defaultNumberOfCycles: number;
}

export const defaultSettings: AppSettings = {
	theme: ThemeMode.System,
	defaultName: "",
	defaultUrl: "",
	defaultMode: CollectionType.Stream,
	defaultIntervalSeconds: 1,
	defaultNumberOfCycles: 0,
};

/**
 * Stored values merged onto the defaults, so a key added in a later release
 * appears without a migration.
 */
function readStored(): AppSettings {
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : null;
		if (typeof parsed !== "object" || parsed === null) {
			return { ...defaultSettings };
		}
		return { ...defaultSettings, ...(parsed as Partial<AppSettings>) };
	} catch {
		return { ...defaultSettings };
	}
}

export class SettingsService {
	readonly #state: AppSettings;
	readonly #db: DBStore;
	readonly #fs: FileStore;
	/** Whether the dark palette is showing, whatever the preference says. */
	#dark = $state(false);

	constructor(db: DBStore, fs: FileStore) {
		this.#state = $state({ ...defaultSettings });
		this.#db = db;
		this.#fs = fs;

		if (browser) {
			this.#apply(readStored());
			// Follow the OS while the theme is "system".
			window
				.matchMedia("(prefers-color-scheme: dark)")
				.addEventListener("change", () => {
					this.#dark = applyTheme(this.#state.theme);
				});
		}
	}

	getSettings(): AppSettings {
		return this.#state;
	}

	isDark(): boolean {
		return this.#dark;
	}

	/** Switch to the palette that is not showing, as an explicit choice. */
	toggleTheme(): void {
		this.updateSettings({
			theme: this.#dark ? ThemeMode.Light : ThemeMode.Dark,
		});
	}

	updateSettings(patch: Partial<AppSettings>): void {
		const next = { ...this.#state, ...patch };
		try {
			localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
		} catch {
			// Storage disabled or full — the in-memory copy stays authoritative.
		}
		this.#apply(next);
	}

	/**
	 * Wipe every project, profile, archived collection and setting, then reload so
	 * every service rehydrates from empty storage.
	 */
	async resetAllData(): Promise<void> {
		await this.#db.clear(ALL_STORES);
		const files = await this.#fs.list().catch(() => []);
		await Promise.all(files.map((name) => this.#fs.remove(name)));
		try {
			localStorage.removeItem(SETTINGS_KEY);
		} catch {
			// Nothing stored, or storage disabled — either way nothing to clear.
		}
		window.location.reload();
	}

	#apply(next: AppSettings): void {
		Object.assign(this.#state, next);
		this.#dark = applyTheme(next.theme);
	}
}

function applyTheme(theme: ThemeMode): boolean {
	const dark =
		theme === ThemeMode.Dark ||
		(theme === ThemeMode.System &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);
	document.documentElement.classList.toggle("dark", dark);
	return dark;
}
