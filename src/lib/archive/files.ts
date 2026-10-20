// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import type { DiskUsage } from "#lib/types";

export function filenameFor(collectionId: string): string {
	return `${collectionId}.ppvz`;
}

/**
 * Storage figures for the archive page. The browser reports quota and usage for
 * the whole origin.
 */
export async function usage(collectionsBytes: number): Promise<DiskUsage> {
	const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
	const totalBytes = estimate?.quota ?? 0;
	const used = estimate?.usage ?? collectionsBytes;
	return {
		collectionsBytes,
		freeBytes: Math.max(0, totalBytes - used),
		totalBytes,
		estimated: estimate !== undefined,
	};
}

/**
 * Ask the browser to make this origin's storage persistent, so collections
 * survive eviction under storage pressure.
 */
export async function requestPersistence(): Promise<boolean> {
	try {
		if (await navigator.storage?.persisted?.()) return true;
		return (await navigator.storage?.persist?.()) ?? false;
	} catch {
		return false;
	}
}
