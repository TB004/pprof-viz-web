// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import type { DBStore } from "#lib/storage/idb.js";
import type { CollectionRow } from "#lib/types";
import { requireText, trimToNull } from "#lib/utils/text.js";
import { Store } from "./database.js";

export class Collections {
	readonly #db: DBStore;

	constructor(db: DBStore) {
		this.#db = db;
	}

	/** Archived collections, newest first. */
	async list(): Promise<CollectionRow[]> {
		const rows = await this.#db.getAll<CollectionRow>(Store.Collections);
		return rows.reverse();
	}

	get(id: string): Promise<CollectionRow | undefined> {
		return this.#db.get<CollectionRow>(Store.Collections, id);
	}

	insert(row: CollectionRow): Promise<void> {
		return this.#db.add(Store.Collections, row);
	}

	rename(id: string, name: string, description: string | null): Promise<void> {
		const trimmed = requireText(name, "collection name");
		return this.#db.update<CollectionRow>(Store.Collections, id, (row) => ({
			...row,
			name: trimmed,
			description: trimToNull(description),
		}));
	}

	remove(id: string): Promise<void> {
		return this.#db.delete(Store.Collections, id);
	}

	async totalBytes(): Promise<number> {
		const rows = await this.list();
		return rows.reduce((sum, row) => sum + row.sizeBytes, 0);
	}
}
