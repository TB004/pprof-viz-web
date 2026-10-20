// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { type DBStore, request } from "#lib/storage/idb.js";
import type {
	CollectionRow,
	ImportPlan,
	ProfileRow,
	ProjectRow,
} from "#lib/types";
import { ALL_STORES, Store } from "./database.js";

/** Every id already taken, so an import can tell new records from collisions. */
export interface ExistingIds {
	projects: Set<string>;
	profiles: Set<string>;
	collections: Set<string>;
}

export class Imports {
	readonly #db: DBStore;

	constructor(db: DBStore) {
		this.#db = db;
	}

	/** The keys of all three stores, read in one consistent snapshot. */
	async existingIds(): Promise<ExistingIds> {
		return this.#db.transaction(ALL_STORES, "readonly", async (tx) => {
			const keys = async (store: Store) =>
				new Set(
					(
						await request<IDBValidKey[]>(tx.objectStore(store).getAllKeys())
					).map(String),
				);
			return {
				projects: await keys(Store.Projects),
				profiles: await keys(Store.Profiles),
				collections: await keys(Store.Collections),
			};
		});
	}

	/**
	 * Write a whole import in one commit, so a failure part way through leaves
	 * the database exactly as it was. `put` rather than `add`: the plan has
	 * already resolved collisions, and replacing is one of the outcomes.
	 */
	async commit(plan: ImportPlan): Promise<void> {
		await this.#db.transaction(ALL_STORES, "readwrite", async (tx) => {
			const projects = tx.objectStore(Store.Projects);
			for (const row of plan.projects) await request(projects.put(row));

			const profiles = tx.objectStore(Store.Profiles);
			for (const row of plan.profiles) await request(profiles.put(row));

			const collections = tx.objectStore(Store.Collections);
			for (const row of plan.collections) await request(collections.put(row));
		});
	}

	/** Every record in the database, for a full backup. */
	async exportAll(): Promise<{
		projects: ProjectRow[];
		profiles: ProfileRow[];
		collections: CollectionRow[];
	}> {
		return this.#db.transaction(ALL_STORES, "readonly", async (tx) => ({
			projects: await request<ProjectRow[]>(
				tx.objectStore(Store.Projects).getAll(),
			),
			profiles: await request<ProfileRow[]>(
				tx.objectStore(Store.Profiles).getAll(),
			),
			collections: await request<CollectionRow[]>(
				tx.objectStore(Store.Collections).getAll(),
			),
		}));
	}
}
