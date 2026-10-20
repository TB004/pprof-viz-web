// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

export const ZSTD_LEVEL = 19;

/** Start of every zstd frame (0xFD2FB528, little-endian). */
export const ZSTD_MAGIC = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd]);

type ZstdModule = typeof import("@bokuweb/zstd-wasm");

/**
 * The wasm instance is per-document, not per-object: calling the module's
 * `init()` a second time re-instantiates it underneath whatever is already
 * using it, and later calls then fail with a source-size error. So the loaded
 * module is shared by every compressor in the tab.
 */
let loaded: Promise<ZstdModule> | null = null;

function load(): Promise<ZstdModule> {
	loaded ??= import("@bokuweb/zstd-wasm")
		.then(async (module) => {
			await module.init();
			return module;
		})
		// A failed load must not be cached, or every later save fails too.
		.catch((error: unknown) => {
			loaded = null;
			throw error;
		});
	return loaded;
}

export class ZstdCompressor {
	async init(): Promise<void> {
		await load();
	}

	async compress(data: Uint8Array): Promise<Uint8Array> {
		const module = await load();
		return new Uint8Array(module.compress(data, ZSTD_LEVEL));
	}

	async decompress(data: Uint8Array): Promise<Uint8Array> {
		const module = await load();
		return new Uint8Array(module.decompress(data));
	}

	static checkMagic(data: Uint8Array): boolean {
		return ZSTD_MAGIC.every((byte, index) => data[index] === byte);
	}
}
