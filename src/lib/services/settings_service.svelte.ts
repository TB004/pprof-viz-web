// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { Reset } from "#lib/data";
import type { DBStore, FileStore, JsonStore } from "#lib/storage";
import { type AppSettings, CollectionType, ThemeMode } from "#lib/types";
import { browser } from "$app/env";

export const SETTINGS_KEY = "pprof-viz-settings";

export const defaultSettings: AppSettings = {
	theme: ThemeMode.System,
	defaultName: "",
	defaultUrl: "",
	defaultMode: CollectionType.Stream,
	defaultIntervalSeconds: 1,
	defaultNumberOfCycles: 0,
};

export class SettingsService {
	readonly #state: AppSettings;
	readonly #store: JsonStore<AppSettings>;
	readonly #reset: Reset;

	constructor(js: JsonStore<AppSettings>, db: DBStore, fs: FileStore) {
		this.#store = js;
		this.#state = $state(js.defaults);
		this.#reset = new Reset(db, fs);

		if (browser) {
			this.apply(this.#store.read());
			// Follow the OS while the theme is "system".
			window
				.matchMedia("(prefers-color-scheme: dark)")
				.addEventListener("change", () => applyTheme(this.#state.theme));
		}
	}

	getSettings(): AppSettings {
		return this.#state;
	}

	apply(next: AppSettings): void {
		Object.assign(this.#state, next);
		applyTheme(next.theme);
	}

	updateSettings(patch: Partial<AppSettings>): void {
		const next = { ...this.#state, ...patch };
		this.#store.write(next);
		this.apply(next);
	}

	/**
	 * Wipe every project, profile, archived collection and setting, then reload so
	 * every service rehydrates from empty storage.
	 */
	async resetAllData(): Promise<void> {
		await this.#reset.cleanAllRecords();
		this.#store.clear();
		window.location.reload();
	}
}

function applyTheme(theme: ThemeMode): void {
	const dark =
		theme === ThemeMode.Dark ||
		(theme === ThemeMode.System &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);
	document.documentElement.classList.toggle("dark", dark);
}
