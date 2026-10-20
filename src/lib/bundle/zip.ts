// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { unzipSync, zipSync } from "fflate";

/** An import is an untrusted file: refuse anything absurd before expanding it. */
export const MAX_ENTRIES = 2048;
export const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024 * 1024;

export const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

export function checkZipMagic(data: Uint8Array): boolean {
	return ZIP_MAGIC.every((byte, index) => data[index] === byte);
}

/**
 * `.ppvz` payloads are already zstd frames, so they are stored rather than
 * deflated; only text entries are worth compressing.
 */
export function zip(
	stored: Record<string, Uint8Array>,
	deflated: Record<string, Uint8Array>,
): Uint8Array {
	const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
	for (const [name, data] of Object.entries(stored)) {
		entries[name] = [data, { level: 0 }];
	}
	for (const [name, data] of Object.entries(deflated)) {
		entries[name] = [data, { level: 6 }];
	}
	return zipSync(entries);
}

export function unzip(data: Uint8Array): Record<string, Uint8Array> {
	let entries: Record<string, Uint8Array>;
	try {
		entries = unzipSync(data);
	} catch (error) {
		throw new Error(
			`not a readable zip archive: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const names = Object.keys(entries);
	if (names.length > MAX_ENTRIES) {
		throw new Error(`archive holds more than ${MAX_ENTRIES} entries`);
	}

	let total = 0;
	for (const name of names) {
		total += entries[name].byteLength;
		if (total > MAX_UNCOMPRESSED_BYTES) {
			throw new Error("archive expands to more data than this app will read");
		}
	}
	return entries;
}
