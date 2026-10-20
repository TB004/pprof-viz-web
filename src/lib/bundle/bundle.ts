// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import type { BundleManifest } from "#lib/types";
import {
	ARCHIVE_EXTENSION,
	MANIFEST_ENTRY,
	payloadEntryId,
	payloadEntryName,
	validateManifest,
} from "./manifest.js";
import { unzip, zip } from "./zip.js";

/** A manifest with the archive payloads it names, keyed by collection id. */
export interface Bundle {
	manifest: BundleManifest;
	payloads: Map<string, Uint8Array>;
}

/** Serialize a bundle into `.ppvzb` bytes. */
export function pack(bundle: Bundle): Uint8Array {
	const stored: Record<string, Uint8Array> = {};
	for (const [id, bytes] of bundle.payloads) {
		stored[payloadEntryName(id)] = bytes;
	}
	const manifest = new TextEncoder().encode(
		JSON.stringify(bundle.manifest, null, "\t"),
	);
	return zip(stored, { [MANIFEST_ENTRY]: manifest });
}

/**
 * Read `.ppvzb` bytes back. Entry names outside `collections/<ulid>.ppvz` are
 * dropped rather than trusted, which is also what keeps a crafted path such as
 * `../evil` from ever reaching the file store.
 */
export function unpack(data: Uint8Array, entries = unzip(data)): Bundle {
	const raw = entries[MANIFEST_ENTRY];
	if (!raw) throw new Error(`bundle has no ${MANIFEST_ENTRY}`);

	let parsed: unknown;
	try {
		parsed = JSON.parse(new TextDecoder().decode(raw));
	} catch {
		throw new Error(`${MANIFEST_ENTRY} is not valid JSON`);
	}
	const manifest = validateManifest(parsed);

	const payloads = new Map<string, Uint8Array>();
	for (const [name, bytes] of Object.entries(entries)) {
		if (name === MANIFEST_ENTRY) continue;
		const id = payloadEntryId(name);
		if (id) payloads.set(id, bytes);
	}

	// Metadata for a payload the bundle does not carry is not an error — a
	// profiles-only export is a legitimate bundle — but a payload nothing points
	// at would be unreachable, so drop it.
	const named = new Set(manifest.collections.map((row) => row.id));
	for (const id of [...payloads.keys()]) {
		if (!named.has(id)) payloads.delete(id);
	}

	return { manifest, payloads };
}

/** Read a plain zip of `.ppvz` files, keyed by the name inside the archive. */
export function unpackArchives(
	data: Uint8Array,
	entries = unzip(data),
): Map<string, Uint8Array> {
	const archives = new Map<string, Uint8Array>();
	for (const [name, bytes] of Object.entries(entries)) {
		if (!name.endsWith(ARCHIVE_EXTENSION)) continue;
		if (bytes.byteLength === 0) continue;
		archives.set(name.slice(name.lastIndexOf("/") + 1), bytes);
	}
	if (archives.size === 0) {
		throw new Error(`the zip holds no ${ARCHIVE_EXTENSION} files`);
	}
	return archives;
}
