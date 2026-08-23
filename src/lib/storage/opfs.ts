// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

/** Resolve a directory under the origin's private root, creating it on demand. */
async function directory(name: string): Promise<FileSystemDirectoryHandle> {
	if (!navigator.storage?.getDirectory) {
		throw new Error("this browser has no Origin Private File System");
	}
	const root = await navigator.storage.getDirectory();
	return root.getDirectoryHandle(name, { create: true });
}

export class FileStore {
	readonly #directory: string;

	constructor(directoryName: string) {
		this.#directory = directoryName;
	}

	async write(filename: string, data: Uint8Array): Promise<void> {
		const dir = await directory(this.#directory);
		const handle = await dir.getFileHandle(filename, { create: true });
		const writable = await handle.createWritable();
		try {
			// A fresh BufferSource: `data` may be a view into a larger worker buffer.
			await writable.write(data.slice().buffer as ArrayBuffer);
		} catch (error) {
			await writable.abort();
			throw error;
		}
		await writable.close();
	}

	async read(filename: string): Promise<Uint8Array> {
		const dir = await directory(this.#directory);
		const handle = await dir.getFileHandle(filename);
		const file = await handle.getFile();
		return new Uint8Array(await file.arrayBuffer());
	}

	/** Delete a file, tolerating one that is already gone. */
	async remove(filename: string): Promise<void> {
		try {
			const dir = await directory(this.#directory);
			await dir.removeEntry(filename);
		} catch (error) {
			if ((error as DOMException)?.name !== "NotFoundError") throw error;
		}
	}

	async list(): Promise<string[]> {
		const dir = await directory(this.#directory);
		const names: string[] = [];
		for await (const name of dir.keys()) names.push(name);
		return names;
	}
}
