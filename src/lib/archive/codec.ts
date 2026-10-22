// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

// The `.ppvz` container: a zstd frame wrapping a protobuf `StoredCollection`,
// byte-compatible with the desktop app.

import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import {
	type CollectionMeta,
	CollectionMetaSchema,
	StoredCollectionSchema,
} from "#lib/proto/gen/collector_pb.js";
import { diffFrame, mergeFrame } from "#lib/session/frames.js";
import type { CollectionRow, Frame, MetadataResponse } from "#lib/types";

/** Bump when the payload layout changes in a way that needs a read migration. */
export const FORMAT_VERSION = 1;

export const ARCHIVE_EXTENSION = ".ppvz";

const ZSTD_LEVEL = 19;

/** Start of every zstd frame (0xFD2FB528, little-endian). */
const ZSTD_MAGIC = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd]);

type ZstdModule = typeof import("@bokuweb/zstd-wasm");

/**
 * The wasm instance is per-document, not per-object: calling the module's
 * `init()` a second time re-instantiates it underneath whatever is already
 * using it, and later calls then fail with a source-size error. So the loaded
 * module is shared by the whole tab, and loaded on the first encode/decode —
 * no page but the archive needs zstd.
 */
let zstd: Promise<ZstdModule> | null = null;

function loadZstd(): Promise<ZstdModule> {
	zstd ??= import("@bokuweb/zstd-wasm")
		.then(async (module) => {
			await module.init();
			return module;
		})
		// A failed load must not be cached, or every later save fails too.
		.catch((error: unknown) => {
			zstd = null;
			throw error;
		});
	return zstd;
}

// Results are views into the wasm heap, so each is copied before the next call
// can overwrite it.
async function compress(data: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array((await loadZstd()).compress(data, ZSTD_LEVEL));
}

async function decompress(data: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array((await loadZstd()).decompress(data));
}

/** True when `data` starts like a zstd frame. */
export function isZstd(data: Uint8Array): boolean {
	return ZSTD_MAGIC.every((byte, index) => data[index] === byte);
}

/** The filename an archived collection is stored under in OPFS. */
export function archiveFilename(collectionId: string): string {
	return `${collectionId}${ARCHIVE_EXTENSION}`;
}

/** The `meta` a file embeds, built from its authoritative metadata row. */
export function collectionMeta(row: CollectionRow): CollectionMeta {
	return create(CollectionMetaSchema, {
		name: row.name,
		description: row.description ?? "",
		profileName: row.profileName ?? "",
		profileUrl: row.profileUrl ?? "",
		mode: row.mode ?? "",
		createdAt: BigInt(row.createdAt),
		durationMs: BigInt(row.durationMs),
		sampleCount: row.sampleCount,
	});
}

/** A collection in the shape the app holds in memory. */
export interface CollectionPayload {
	frames: Frame[];
	frameTimestamps: number[];
	metadata: MetadataResponse | null;
	meta: CollectionMeta;
}

/** Protobuf encoding is deterministic here, so bytes are a fair comparison. */
function sameMeta(a: CollectionMeta, b: CollectionMeta): boolean {
	const left = toBinary(CollectionMetaSchema, a);
	const right = toBinary(CollectionMetaSchema, b);
	if (left.length !== right.length) return false;
	return left.every((byte, index) => byte === right[index]);
}

/** Serialize an in-memory collection into `.ppvz` bytes. */
export async function encodeArchive(
	payload: CollectionPayload,
): Promise<Uint8Array> {
	const stored = create(StoredCollectionSchema, {
		formatVersion: FORMAT_VERSION,
		metadata: payload.metadata ?? undefined,
		frames: payload.frames.map((frame, index) =>
			diffFrame(index === 0 ? null : payload.frames[index - 1], frame),
		),
		frameTimestamps: payload.frameTimestamps.map((ms) => BigInt(ms)),
		meta: payload.meta,
	});

	return compress(toBinary(StoredCollectionSchema, stored));
}

/** Read `.ppvz` bytes back into dense, replayable frames. */
export async function decodeArchive(
	bytes: Uint8Array,
): Promise<CollectionPayload> {
	// Compression is optional in the container.
	let body: Uint8Array;
	try {
		body = isZstd(bytes) ? await decompress(bytes) : bytes;
	} catch (error) {
		throw new Error(
			`not a readable .ppvz file: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	let stored: ReturnType<typeof fromBinary<typeof StoredCollectionSchema>>;
	try {
		stored = fromBinary(StoredCollectionSchema, body);
	} catch {
		throw new Error("not a .ppvz file");
	}

	if (stored.formatVersion > FORMAT_VERSION) {
		throw new Error(
			`.ppvz format version ${stored.formatVersion} is newer than this build understands`,
		);
	}

	// Replay the deltas back into the dense frames the dashboards read.
	const frames: Frame[] = [];
	let previous: Frame | null = null;
	for (const sparse of stored.frames) {
		previous = mergeFrame(previous, sparse);
		frames.push(previous);
	}

	return {
		frames,
		frameTimestamps: stored.frameTimestamps.map(Number),
		metadata: stored.metadata ?? null,
		meta: stored.meta ?? create(CollectionMetaSchema, {}),
	};
}

/**
 * Return bytes whose embedded `meta` matches `meta`, re-encoding only when it
 * differs. Collections are renamed through the metadata row, which never
 * rewrites the file, so an exported copy would otherwise carry a stale name.
 * Frames are left as the sparse deltas they already are — no replay.
 */
export async function rewriteMeta(
	bytes: Uint8Array,
	meta: CollectionMeta,
): Promise<Uint8Array> {
	const compressed = isZstd(bytes);
	const body = compressed ? await decompress(bytes) : bytes;
	const stored = fromBinary(StoredCollectionSchema, body);

	const current = stored.meta ?? create(CollectionMetaSchema, {});
	if (sameMeta(current, meta)) return bytes;

	stored.meta = meta;
	const rewritten = toBinary(StoredCollectionSchema, stored);
	return compressed ? compress(rewritten) : rewritten;
}
