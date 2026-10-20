// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import {
	type CollectionMeta,
	CollectionMetaSchema,
	StoredCollectionSchema,
} from "#lib/proto/gen/collector_pb.js";
import type { Frame, MetadataResponse } from "#lib/types";
import { FrameUtils } from "#lib/utils";
import { ZstdCompressor } from "./zstd.js";

/** Bump when the payload layout changes in a way that needs a read migration. */
export const FORMAT_VERSION = 1;

export type { CollectionMeta };
export { CollectionMetaSchema };

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

export class Archive {
	readonly #compressor: ZstdCompressor;

	constructor() {
		// The wasm module loads on the first encode/decode: the archive service is
		// constructed at startup, and no page but the archive needs zstd.
		this.#compressor = new ZstdCompressor();
	}

	/** Serialize an in-memory collection into `.ppvz` bytes. */
	async encode(payload: CollectionPayload): Promise<Uint8Array> {
		const stored = create(StoredCollectionSchema, {
			formatVersion: FORMAT_VERSION,
			metadata: payload.metadata ?? undefined,
			frames: payload.frames.map((frame, index) =>
				FrameUtils.diffFrame(
					index === 0 ? null : payload.frames[index - 1],
					frame,
				),
			),
			frameTimestamps: payload.frameTimestamps.map((ms) => BigInt(ms)),
			meta: payload.meta,
		});

		const data = toBinary(StoredCollectionSchema, stored);
		return this.#compressor.compress(data);
	}

	/** Read `.ppvz` bytes back into dense, replayable frames. */
	async decode(bytes: Uint8Array): Promise<CollectionPayload> {
		// Compression is optional in the container.
		let body: Uint8Array;
		try {
			body = ZstdCompressor.checkMagic(bytes)
				? await this.#compressor.decompress(bytes)
				: bytes;
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
			previous = FrameUtils.mergeFrame(previous, sparse);
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
	async rewriteMeta(
		bytes: Uint8Array,
		meta: CollectionMeta,
	): Promise<Uint8Array> {
		const compressed = ZstdCompressor.checkMagic(bytes);
		const body = compressed ? await this.#compressor.decompress(bytes) : bytes;
		const stored = fromBinary(StoredCollectionSchema, body);

		const current = stored.meta ?? create(CollectionMetaSchema, {});
		if (sameMeta(current, meta)) return bytes;

		stored.meta = meta;
		const rewritten = toBinary(StoredCollectionSchema, stored);
		return compressed ? this.#compressor.compress(rewritten) : rewritten;
	}
}
