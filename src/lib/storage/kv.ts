// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

export class JsonStore<T extends object> {
	readonly #key: string;
	readonly #defaults: T;

	constructor(key: string, defaults: T) {
		this.#key = key;
		this.#defaults = defaults;
	}

	get defaults(): T {
		return { ...this.#defaults };
	}

	/**
	 * Stored values merged onto the defaults, so a key added in a later release
	 * appears without a migration.
	 */
	read(): T {
		try {
			const raw = localStorage.getItem(this.#key);
			if (!raw) return this.defaults;
			const parsed: unknown = JSON.parse(raw);
			if (typeof parsed !== "object" || parsed === null) return this.defaults;
			return { ...this.#defaults, ...(parsed as Partial<T>) };
		} catch {
			return this.defaults;
		}
	}

	/** Persist, ignoring quota and private-mode failures. */
	write(value: T): void {
		try {
			localStorage.setItem(this.#key, JSON.stringify(value));
		} catch {
			// Storage disabled or full — the in-memory copy stays authoritative.
		}
	}

	clear(): void {
		try {
			localStorage.removeItem(this.#key);
		} catch {
			// nothing to do
		}
	}
}
