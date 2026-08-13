// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import * as Ipc from "$lib/ipc";
import type { CollectionRow, DiskUsage } from "$lib/types";
import * as ErrorService from "./error_service.svelte.js";

export interface ArchiveState {
	collections: CollectionRow[];
	diskUsage?: DiskUsage;
	loading: boolean;
}

/** The archive listing. Treat as read-only outside this module. */
export const archiveState: ArchiveState = $state({
	collections: [],
	loading: false,
});

/** Reload the collection list and disk-usage figures from the backend. */
export async function refresh(): Promise<void> {
	archiveState.loading = true;
	try {
		const [collections, diskUsage] = await Promise.all([
			Ipc.listCollections(),
			Ipc.getDiskUsage(),
		]);

		archiveState.collections = collections;
		archiveState.diskUsage = diskUsage;
	} catch (e) {
		await ErrorService.registerError(
			e instanceof Error ? e.message : `Failed to load archive: ${e}`,
		);
	} finally {
		archiveState.loading = false;
	}
}

/**
 * Run an archive operation and report any failure, returning whether it
 * succeeded. With `reload`, the collection list is refreshed afterwards — only
 * on success, since a failed operation changed nothing.
 */
async function withReporting(
	label: string,
	op: () => Promise<unknown>,
	{ reload = false }: { reload?: boolean } = {},
): Promise<boolean> {
	try {
		await op();
		if (reload) await refresh();
		return true;
	} catch (e) {
		await ErrorService.registerError(
			e instanceof Error ? e.message : `Failed to ${label} collection: ${e}`,
		);
		return false;
	}
}

/** Persist the current in-memory collection to disk, then refresh the list. */
export async function save(
	name: string,
	description: string | null,
): Promise<boolean> {
	return withReporting("save", () => Ipc.saveCollection(name, description), {
		reload: true,
	});
}

/** Edit a stored collection's name/description, then refresh the list. */
export async function update(
	id: string,
	name: string,
	description: string | null,
): Promise<boolean> {
	return withReporting(
		"update",
		() => Ipc.updateCollection(id, name, description),
		{ reload: true },
	);
}

/** Delete a stored collection (file + metadata), then refresh the list. */
export async function remove(id: string): Promise<void> {
	await withReporting("delete", () => Ipc.deleteCollection(id), {
		reload: true,
	});
}

/** Load a stored collection back into memory for visualization. */
export async function load(id: string): Promise<boolean> {
	return withReporting("load", () => Ipc.loadCollection(id));
}
