// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { type Readable, writable } from "svelte/store";
import * as Ipc from "$lib/ipc";
import { ErrorService } from "$lib/services";
import type { CollectionRow, DiskUsage } from "$lib/types";

export interface ArchiveState {
	collections: CollectionRow[];
	diskUsage?: DiskUsage;
	loading: boolean;
}

const defaultArchiveState: ArchiveState = {
	collections: [],
	loading: false,
};

const archiveStateStore = writable<ArchiveState>(defaultArchiveState);

export const archiveState: Readable<ArchiveState> = {
	subscribe: archiveStateStore.subscribe,
};

/** Reload the collection list and disk-usage figures from the backend. */
export async function refresh(): Promise<void> {
	archiveStateStore.update((s) => ({ ...s, loading: true }));
	try {
		const [collections, diskUsage] = await Promise.all([
			Ipc.listCollections(),
			Ipc.getDiskUsage(),
		]);

		archiveStateStore.set({
			collections: collections as CollectionRow[],
			diskUsage: diskUsage as DiskUsage,
			loading: false,
		});
	} catch (e) {
		archiveStateStore.update((s) => ({ ...s, loading: false }));
		await ErrorService.registerError(
			e instanceof Error ? e.message : `Failed to load archive: ${e}`,
		);
	}
}

/** Persist the current in-memory collection to disk, then refresh the list. */
export async function save(
	name: string,
	description: string | null,
): Promise<boolean> {
	try {
		await Ipc.saveCollection(name, description);
		await refresh();
		return true;
	} catch (e) {
		await ErrorService.registerError(
			e instanceof Error ? e.message : `Failed to save collection: ${e}`,
		);
		return false;
	}
}

/** Edit a stored collection's name/description, then refresh the list. */
export async function update(
	id: string,
	name: string,
	description: string | null,
): Promise<boolean> {
	try {
		await Ipc.updateCollection(id, name, description);
		await refresh();
		return true;
	} catch (e) {
		await ErrorService.registerError(
			e instanceof Error ? e.message : `Failed to update collection: ${e}`,
		);
		return false;
	}
}

/** Delete a stored collection (file + metadata), then refresh the list. */
export async function remove(id: string): Promise<void> {
	try {
		await Ipc.deleteCollection(id);
		await refresh();
	} catch (e) {
		await ErrorService.registerError(
			e instanceof Error ? e.message : `Failed to delete collection: ${e}`,
		);
	}
}

/** Load a stored collection back into memory for visualization. */
export async function load(id: string): Promise<boolean> {
	try {
		await Ipc.loadCollection(id);
		return true;
	} catch (e) {
		await ErrorService.registerError(
			e instanceof Error ? e.message : `Failed to load collection: ${e}`,
		);
		return false;
	}
}
