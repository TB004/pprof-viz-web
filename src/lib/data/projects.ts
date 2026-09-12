// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import type { DBStore } from "$lib/storage/idb.js";
import type { ProjectRow } from "$lib/types";
import { TextUtils, ulid } from "$lib/utils";
import { ProfileIndex, Store } from "./database.js";

export class Projects {
	readonly #db: DBStore;

	constructor(db: DBStore) {
		this.#db = db;
	}

	list(): Promise<ProjectRow[]> {
		return this.#db.getAll<ProjectRow>(Store.Projects);
	}

	get(id: string): Promise<ProjectRow | undefined> {
		return this.#db.get<ProjectRow>(Store.Projects, id);
	}

	async create(name: string): Promise<ProjectRow> {
		const now = Date.now();
		const row: ProjectRow = {
			id: ulid(now),
			name: TextUtils.requireText(name, "project name"),
			createdAt: now,
			updatedAt: now,
		};
		await this.#db.add(Store.Projects, row);
		return row;
	}

	rename(id: string, name: string): Promise<void> {
		const trimmed = TextUtils.requireText(name, "project name");
		return this.#db.update<ProjectRow>(Store.Projects, id, (row) => ({
			...row,
			name: trimmed,
			updatedAt: Date.now(),
		}));
	}

	/** Delete a project and every profile that belongs to it. */
	remove(id: string): Promise<void> {
		return this.#db.delete(Store.Projects, id, {
			store: Store.Profiles,
			index: ProfileIndex.ByProject,
		});
	}
}
