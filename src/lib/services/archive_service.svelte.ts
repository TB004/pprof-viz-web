// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { create } from "@bufbuild/protobuf";
import {
	Archive,
	Utils as ArchiveUtils,
	CollectionMetaSchema,
} from "$lib/archive";
import { Collections } from "$lib/data";
import type { DBStore, FileStore } from "$lib/storage";
import type { CollectionRow, DiskUsage } from "$lib/types";
import { TextUtils, ulid } from "$lib/utils";
import type { CollectionService } from "./collection_service.svelte.js";
import type { ErrorService } from "./error_service.svelte.js";

export interface ArchiveState {
	collections: CollectionRow[];
	diskUsage?: DiskUsage;
	loading: boolean;
}

export class ArchiveService {
	readonly #state: ArchiveState;
	readonly #collections: Collections;
	readonly #archive: Archive;
	readonly #fs: FileStore;
	readonly #session: CollectionService;
	readonly #errors: ErrorService;

	constructor(
		db: DBStore,
		fs: FileStore,
		session: CollectionService,
		errors: ErrorService,
	) {
		this.#collections = new Collections(db);
		this.#archive = new Archive();
		this.#fs = fs;
		this.#session = session;
		this.#errors = errors;
		this.#state = $state<ArchiveState>({
			collections: [],
			loading: false,
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
			const collections = await this.#collections.list();
			const total = collections.reduce((sum, row) => sum + row.sizeBytes, 0);
			this.#state.collections = collections;
			this.#state.diskUsage = await ArchiveUtils.usage(total);
		} catch (error) {
			this.#errors.reportFailure("Failed to load archive", error);
		} finally {
			this.#state.loading = false;
		}
	}

	/** Persist the current in-memory collection, then refresh the list. */
	save(name: string, description: string | null): Promise<boolean> {
		return this.#guarded(
			"save",
			() => this.#writeCollection(name, description),
			{
				reload: true,
			},
		);
	}

	/** Edit a stored collection's name and description. */
	update(
		id: string,
		name: string,
		description: string | null,
	): Promise<boolean> {
		return this.#guarded(
			"update",
			() => this.#collections.rename(id, name, description),
			{ reload: true },
		);
	}

	/** Delete a stored collection: its metadata row and its payload. */
	remove(id: string): Promise<boolean> {
		return this.#guarded(
			"delete",
			async () => {
				const row = await this.#collections.get(id);
				await this.#collections.remove(id);
				if (row) await this.#fs.remove(row.filename);
			},
			{ reload: true },
		);
	}

	/** Load a stored collection back into memory for visualization. */
	load(id: string): Promise<boolean> {
		return this.#guarded("load", async () => {
			const row = await this.#collections.get(id);
			if (!row) throw new Error(`collection "${id}" not found`);

			const payload = await this.#archive.decode(
				await this.#fs.read(row.filename),
			);
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
		});
	}

	/** Run an archive operation, reporting any failure to the error log. */
	async #guarded(
		label: string,
		operation: () => Promise<unknown>,
		{ reload = false }: { reload?: boolean } = {},
	): Promise<boolean> {
		try {
			await operation();
			if (reload) await this.refresh();
			return true;
		} catch (error) {
			this.#errors.reportFailure(`Failed to ${label} collection`, error);
			return false;
		}
	}

	async #writeCollection(
		name: string,
		description: string | null,
	): Promise<void> {
		const trimmedName = TextUtils.requireText(name, "collection name");
		const trimmedDescription = TextUtils.trimToNull(description);

		const session = this.#session.snapshot();
		if (session.frames.length === 0)
			throw new Error("no collected data to save");
		if (session.startedAt === undefined)
			throw new Error("collection has no start time");

		const createdAt = Date.now();
		const durationMs = Math.max(
			0,
			(session.endedAt ?? createdAt) - session.startedAt,
		);
		const id = ulid(createdAt);
		const filename = ArchiveUtils.filenameFor(id);

		const meta = create(CollectionMetaSchema, {
			name: trimmedName,
			description: trimmedDescription ?? "",
			profileName: session.profileName ?? "",
			profileUrl: session.profileUrl ?? "",
			mode: session.mode ?? "",
			createdAt: BigInt(createdAt),
			durationMs: BigInt(durationMs),
			sampleCount: session.frames.length,
		});

		const bytes = await this.#archive.encode({
			frames: session.frames,
			frameTimestamps: session.frameTimestamps,
			metadata: session.metadata,
			meta,
		});

		// Ask for persistent storage the first time something is worth keeping.
		void ArchiveUtils.requestPersistence();

		await this.#fs.write(filename, bytes);
		try {
			await this.#collections.insert({
				id,
				name: trimmedName,
				description: trimmedDescription,
				filename,
				sizeBytes: bytes.byteLength,
				durationMs,
				sampleCount: session.frames.length,
				profileName: session.profileName,
				profileUrl: session.profileUrl,
				mode: session.mode,
				createdAt,
			});
		} catch (error) {
			// Never leave a payload the metadata does not point at.
			await this.#fs.remove(filename);
			throw error;
		}

		this.#session.markSaved();
	}
}
