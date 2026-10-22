// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

// IndexedDB: a small promise wrapper and the app's one database.

/** Adapt a single IndexedDB request to a promise. */
export function request<T>(source: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		source.onsuccess = () => resolve(source.result);
		source.onerror = () =>
			reject(source.error ?? new Error("IndexedDB request failed"));
	});
}

/** Applied in order for every version the open database has not seen yet. */
export type Upgrade = (db: IDBDatabase, from: number) => void;

/** Rows indexed by `index` under the deleted key go with it, in one commit. */
export type Cascade = { store: string; index: string };

function openDatabase(
	name: string,
	version: number,
	upgrade: Upgrade,
): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const open = indexedDB.open(name, version);
		open.onupgradeneeded = (event) => upgrade(open.result, event.oldVersion);
		open.onblocked = () =>
			reject(new Error(`database "${name}" is blocked by another open tab`));
		open.onsuccess = () => {
			// Another tab wants a newer schema: close so it is not blocked, and let
			// the next call reopen. The handle is cached, so this is rare.
			open.result.onversionchange = () => open.result.close();
			resolve(open.result);
		};
		open.onerror = () =>
			reject(open.error ?? new Error(`failed to open "${name}"`));
	});
}

/** One IndexedDB database, opened lazily and shared by every caller in the tab. */
export class DBStore {
	readonly #name: string;
	readonly #version: number;
	readonly #upgrade: Upgrade;
	#handle: Promise<IDBDatabase> | undefined;

	constructor(name: string, version: number, upgrade: Upgrade) {
		this.#name = name;
		this.#version = version;
		this.#upgrade = upgrade;
	}

	/** The shared database handle, opened once per tab. */
	open(): Promise<IDBDatabase> {
		this.#handle ??= openDatabase(
			this.#name,
			this.#version,
			this.#upgrade,
		).catch((error: unknown) => {
			// Do not cache a rejected open — a later call should retry.
			this.#handle = undefined;
			throw error;
		});
		return this.#handle;
	}

	get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
		return this.transaction(store, "readonly", (tx) =>
			request<T | undefined>(tx.objectStore(store).get(key)),
		);
	}

	getAll<T>(store: string): Promise<T[]> {
		return this.transaction(store, "readonly", (tx) =>
			request<T[]>(tx.objectStore(store).getAll()),
		);
	}

	async add(store: string, value: unknown): Promise<void> {
		await this.transaction(store, "readwrite", (tx) =>
			request(tx.objectStore(store).add(value)),
		);
	}

	async update<T>(
		store: string,
		key: IDBValidKey,
		mutate: (row: T) => T,
	): Promise<void> {
		await this.transaction(store, "readwrite", async (tx) => {
			const objectStore = tx.objectStore(store);
			const row = await request<T | undefined>(objectStore.get(key));
			if (row === undefined) {
				throw new Error(`${store}: "${String(key)}" not found`);
			}
			await request(objectStore.put(mutate(row)));
		});
	}

	async delete(
		store: string,
		key: IDBValidKey,
		cascade?: Cascade,
	): Promise<void> {
		const stores = cascade ? [store, cascade.store] : store;
		await this.transaction(stores, "readwrite", async (tx) => {
			if (cascade) {
				const child = tx.objectStore(cascade.store);
				const keys = await request<IDBValidKey[]>(
					child.index(cascade.index).getAllKeys(key),
				);
				for (const childKey of keys) await request(child.delete(childKey));
			}
			await request(tx.objectStore(store).delete(key));
		});
	}

	async clear(stores: string | string[]): Promise<void> {
		const names = typeof stores === "string" ? [stores] : stores;
		await this.transaction(names, "readwrite", async (tx) => {
			for (const name of names) await request(tx.objectStore(name).clear());
		});
	}

	/**
	 * Run several reads and writes in one commit. Callers wrap each request with
	 * `request()`; anything that throws aborts the whole transaction.
	 */
	async transaction<T>(
		stores: string | string[],
		mode: IDBTransactionMode,
		body: (tx: IDBTransaction) => Promise<T> | T,
	): Promise<T> {
		const db = await this.open();
		return new Promise<T>((resolve, reject) => {
			let result: T;
			let tx: IDBTransaction;
			try {
				tx = db.transaction(stores, mode);
			} catch (error) {
				reject(error);
				return;
			}
			tx.oncomplete = () => resolve(result);
			tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
			tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));

			Promise.resolve(body(tx)).then(
				(value) => {
					result = value;
				},
				(error: unknown) => {
					reject(error);
					tx.abort();
				},
			);
		});
	}
}

// --- the app's database ---

const DATABASE_NAME = "pprof-viz";
const DATABASE_VERSION = 1;

export enum Store {
	Projects = "projects",
	Profiles = "profiles",
	Collections = "collections",
}

export const ProfileIndex = { ByProject: "projectId" } as const;

export const ALL_STORES: string[] = Object.values(Store);

/** The shared database, opened on first use. */
export const db = new DBStore(DATABASE_NAME, DATABASE_VERSION, (db, from) => {
	if (from < 1) {
		db.createObjectStore(Store.Projects, { keyPath: "id" });
		const profiles = db.createObjectStore(Store.Profiles, { keyPath: "id" });
		profiles.createIndex(ProfileIndex.ByProject, "projectId", {
			unique: false,
		});
		db.createObjectStore(Store.Collections, { keyPath: "id" });
	}
});
