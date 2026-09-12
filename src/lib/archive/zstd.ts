// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

export const ZSTD_LEVEL = 19;

/** Start of every zstd frame (0xFD2FB528, little-endian). */
export const ZSTD_MAGIC = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd]);

type ZstdModule = typeof import("@bokuweb/zstd-wasm");

export class ZstdCompressor {
	#module: Promise<ZstdModule> | null = null;

	async init(): Promise<void> {
		if (!this.#module) {
			this.#module = import("@bokuweb/zstd-wasm")
				.then(async (module) => {
					await module.init();
					return module;
				})
				// A failed load must not be cached, or every later save fails too.
				.catch((error) => {
					this.#module = null;
					throw error;
				});
		}
	}

	async compress(data: Uint8Array): Promise<Uint8Array> {
		await this.init();
		if (!this.#module) throw new Error("Zstd module could not be loaded");
		const module = await this.#module;
		return module.compress(data, ZSTD_LEVEL);
	}

	async decompress(data: Uint8Array): Promise<Uint8Array> {
		await this.init();
		if (!this.#module) throw new Error("Zstd module could not be loaded");
		const module = await this.#module;
		return module.decompress(data);
	}

	static checkMagic(data: Uint8Array): boolean {
		return ZSTD_MAGIC.every((byte, index) => data[index] === byte);
	}
}
