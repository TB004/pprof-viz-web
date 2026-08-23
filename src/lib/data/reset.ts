// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import type { DBStore } from "$lib/storage/idb.js";
import type { FileStore } from "$lib/storage/opfs.js";
import { ALL_STORES } from "./database.js";

export class Reset {
  readonly #db: DBStore;
  readonly #fs: FileStore;

	constructor(db: DBStore, fs: FileStore) {
    this.#db = db;
    this.#fs = fs;
	}

	/**
	 * Drop every record and every archived payload. Settings live in localStorage
	 * and are cleared separately by the settings service.
	 */
	async cleanAllRecords(): Promise<void> {
		await this.#db.clear(ALL_STORES);

		const files = await this.#fs.list().catch(() => []);
		await Promise.all(files.map((name) => this.#fs.remove(name)));
	}
}
