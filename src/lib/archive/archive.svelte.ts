// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { type DBStore, Store } from "#lib/db";
import {
	type DiskUsage,
	diskUsage,
	type FileStore,
	requestPersistence,
} from "#lib/files";
import type { CollectionService } from "#lib/session/session.svelte.js";
import type { CollectionRow } from "#lib/types";
import { errorMessage, requireText, trimToNull, ulid } from "#lib/utils";
import {
	archiveFilename,
	collectionMeta,
	decodeArchive,
	encodeArchive,
} from "./codec.js";

export interface ArchiveState {
	collections: CollectionRow[];
	diskUsage?: DiskUsage;
	loading: boolean;
	/** Why the listing could not be read; shown on the archive page. */
	error: string | null;
}

/**
 * Saved collections: a metadata row in IndexedDB per `.ppvz` payload in OPFS.
 * Every action throws, for the component that started it to report.
 */
export class ArchiveService {
	readonly #state: ArchiveState;
	readonly #db: DBStore;
	readonly #fs: FileStore;
	readonly #session: CollectionService;

	constructor(db: DBStore, fs: FileStore, session: CollectionService) {
		this.#db = db;
		this.#fs = fs;
		this.#session = session;
		this.#state = $state<ArchiveState>({
			collections: [],
			loading: false,
			error: null,
		});
	}

	/** The archive listing. Reactive; treat as read-only outside this class. */
	getState(): ArchiveState {
		return this.#state;
	}

	/** Reload the collection list and the origin's storage figures. */
	async refresh(): Promise<void> {
		this.#state.loading = true;
		try {
			// Newest first: ULID keys sort by creation time.
			const collections = (
				await this.#db.getAll<CollectionRow>(Store.Collections)
			).reverse();
			const total = collections.reduce((sum, row) => sum + row.sizeBytes, 0);
			this.#state.collections = collections;
			this.#state.diskUsage = await diskUsage(total);
			this.#state.error = null;
		} catch (error) {
			this.#state.error = `Failed to load the archive: ${errorMessage(error)}`;
		} finally {
			this.#state.loading = false;
		}
	}

	get(id: string): Promise<CollectionRow | undefined> {
		return this.#db.get<CollectionRow>(Store.Collections, id);
	}

	/** Persist the current in-memory collection, then refresh the list. */
	async save(name: string, description: string | null): Promise<void> {
		await this.#writeCollection(name, description);
		this.#session.markSaved();
		await this.refresh();
	}

	/** Edit a stored collection's name and description. */
	async update(
		id: string,
		name: string,
		description: string | null,
	): Promise<void> {
		const trimmed = requireText(name, "collection name");
		await this.#db.update<CollectionRow>(Store.Collections, id, (row) => ({
			...row,
			name: trimmed,
			description: trimToNull(description),
		}));
		await this.refresh();
	}

	/** Delete a stored collection: its metadata row and its payload. */
	async remove(id: string): Promise<void> {
		const row = await this.get(id);
		await this.#db.delete(Store.Collections, id);
		if (row) await this.#fs.remove(row.filename);
		await this.refresh();
	}

	/** Load a stored collection back into memory for visualization. */
	async load(id: string): Promise<void> {
		const row = await this.get(id);
		if (!row) throw new Error(`collection "${id}" not found`);

		const payload = await decodeArchive(await this.#fs.read(row.filename));
		// The metadata row is authoritative — it reflects any later edits.
		this.#session.installLoaded({
			frames: payload.frames,
			frameTimestamps: payload.frameTimestamps,
			metadata: payload.metadata,
			profileUrl: row.profileUrl,
			mode: row.mode,
			startedAt: row.createdAt,
			durationMs: row.durationMs,
		});
	}

	async #writeCollection(
		name: string,
		description: string | null,
	): Promise<void> {
		const session = this.#session.snapshot();
		if (session.frames.length === 0) {
			throw new Error("no collected data to save");
		}
		if (session.startedAt === undefined) {
			throw new Error("collection has no start time");
		}

		const createdAt = Date.now();
		const id = ulid(createdAt);
		const durationMs = Math.max(
			0,
			(session.endedAt ?? createdAt) - session.startedAt,
		);
		const row: CollectionRow = {
			id,
			name: requireText(name, "collection name"),
			description: trimToNull(description),
			filename: archiveFilename(id),
			sizeBytes: 0,
			durationMs,
			sampleCount: session.frames.length,
			profileName: session.profileName,
			profileUrl: session.profileUrl,
			mode: session.mode,
			createdAt,
		};

		const bytes = await encodeArchive({
			frames: session.frames,
			frameTimestamps: session.frameTimestamps,
			metadata: session.metadata,
			meta: collectionMeta(row),
		});
		row.sizeBytes = bytes.byteLength;

		// Ask for persistent storage the first time something is worth keeping.
		void requestPersistence();

		await this.#fs.write(row.filename, bytes);
		try {
			await this.#db.add(Store.Collections, row);
		} catch (error) {
			// Never leave a payload the metadata does not point at.
			await this.#fs.remove(row.filename);
			throw error;
		}
	}
}
