// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { unzipSync, zipSync } from "fflate";
import { ARCHIVE_EXTENSION, isZstd } from "#lib/archive/codec.js";
import {
	type BundleManifest,
	MANIFEST_ENTRY,
	payloadEntryId,
	payloadEntryName,
	validateManifest,
} from "./manifest.js";

/** An import is an untrusted file: refuse anything absurd before expanding it. */
const MAX_ENTRIES = 2048;
const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024 * 1024;

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

/** The shape of an import file, decided by sniffing its first bytes. */
export const TransferKind = {
	Archive: "archive",
	ArchiveZip: "archive-zip",
	Bundle: "bundle",
} as const;
export type TransferKind = (typeof TransferKind)[keyof typeof TransferKind];

/** A manifest with the archive payloads it names, keyed by collection id. */
export interface Bundle {
	manifest: BundleManifest;
	payloads: Map<string, Uint8Array>;
}

export interface Detected {
	kind: TransferKind;
	/** The expanded zip, so callers never pay to read the container twice. */
	entries?: Record<string, Uint8Array>;
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

function unzip(data: Uint8Array): Record<string, Uint8Array> {
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

/**
 * Decide what a picked file is from its bytes, not its extension. A bare
 * `.ppvz` is a zstd frame; a zip is a bundle when it carries a manifest and a
 * plain collection of archives when it does not.
 */
export function detect(data: Uint8Array): Detected {
	// Decoding tolerates an uncompressed payload, so anything that is not a zip
	// is still worth offering to the protobuf parser.
	const isZip = ZIP_MAGIC.every((byte, index) => data[index] === byte);
	if (!isZip || isZstd(data)) return { kind: TransferKind.Archive };

	const entries = unzip(data);
	return {
		kind:
			MANIFEST_ENTRY in entries ? TransferKind.Bundle : TransferKind.ArchiveZip,
		entries,
	};
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
