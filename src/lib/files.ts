// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

// Files in and out of the browser: the Origin Private File System the archive
// lives in, the origin's storage quota, and the open and save dialogs.

// --- Origin Private File System ---

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

// --- quota ---

/** Origin storage figures, from the Storage Manager API. */
export interface DiskUsage {
	/** Bytes occupied by archived collections, summed from their metadata. */
	collectionsBytes: number;
	freeBytes: number;
	totalBytes: number;
	/** False when the browser refuses an estimate, making the figures a guess. */
	estimated: boolean;
}

/**
 * Storage figures for the archive page. The browser reports quota and usage for
 * the whole origin.
 */
export async function diskUsage(collectionsBytes: number): Promise<DiskUsage> {
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

// --- open and save dialogs ---

interface PickerType {
	description: string;
	accept: Record<string, string[]>;
}

interface Pickers {
	showOpenFilePicker?: (options: {
		multiple?: boolean;
		excludeAcceptAllOption?: boolean;
		types?: PickerType[];
	}) => Promise<FileSystemFileHandle[]>;
	showSaveFilePicker?: (options: {
		suggestedName?: string;
		types?: PickerType[];
	}) => Promise<FileSystemFileHandle>;
}

/** Thrown by the file pickers when the user closes the dialog. */
function isAbort(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

export interface PickedFile {
	name: string;
	bytes: Uint8Array;
}

export interface PickOptions {
	/** Extensions for the dialog's filter, e.g. `[".ppvz", ".ppvzb"]`. */
	extensions: string[];
	description: string;
	multiple?: boolean;
}

/** Ask the user for files and read them. Empty when the dialog is cancelled. */
export async function pickFiles(options: PickOptions): Promise<PickedFile[]> {
	const files = await chooseFiles(options);
	return Promise.all(
		files.map(async (file) => ({
			name: file.name,
			bytes: new Uint8Array(await file.arrayBuffer()),
		})),
	);
}

async function chooseFiles(options: PickOptions): Promise<File[]> {
	const picker = (globalThis as Pickers).showOpenFilePicker;
	if (picker) {
		try {
			const handles = await picker({
				multiple: options.multiple ?? false,
				excludeAcceptAllOption: false,
				types: [
					{
						description: options.description,
						// The picker keys by MIME type; ours are not registered, so an
						// octet-stream entry carrying the extensions is what filters.
						accept: { "application/octet-stream": options.extensions },
					},
				],
			});
			return Promise.all(handles.map((handle) => handle.getFile()));
		} catch (error) {
			if (isAbort(error)) return [];
			throw error;
		}
	}

	return new Promise<File[]>((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = options.extensions.join(",");
		input.multiple = options.multiple ?? false;
		input.style.display = "none";
		// A cancelled dialog fires nothing in older browsers, so the element is
		// only removed once something resolves it.
		input.addEventListener("change", () => {
			resolve([...(input.files ?? [])]);
			input.remove();
		});
		input.addEventListener("cancel", () => {
			resolve([]);
			input.remove();
		});
		document.body.append(input);
		input.click();
	});
}

/**
 * Hand a file to the user. The File System Access API gives a real Save dialog
 * and streams straight to disk; everywhere else falls back to an object URL.
 * Returns false when the user cancels the dialog.
 */
export async function saveFile(
	suggestedName: string,
	data: Uint8Array,
	mimeType: string,
	description: string,
): Promise<boolean> {
	const extension = suggestedName.slice(suggestedName.lastIndexOf("."));
	// A fresh copy: `data` may be a view into a larger buffer.
	const blob = new Blob([data.slice().buffer as ArrayBuffer], {
		type: mimeType,
	});

	const picker = (globalThis as Pickers).showSaveFilePicker;
	if (picker) {
		let handle: FileSystemFileHandle;
		try {
			handle = await picker({
				suggestedName,
				types: [{ description, accept: { [mimeType]: [extension] } }],
			});
		} catch (error) {
			if (isAbort(error)) return false;
			throw error;
		}
		const writable = await handle.createWritable();
		try {
			await writable.write(blob);
		} catch (error) {
			await writable.abort();
			throw error;
		}
		await writable.close();
		return true;
	}

	const url = URL.createObjectURL(blob);
	try {
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = suggestedName;
		anchor.rel = "noopener";
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
	} finally {
		// The download has been handed to the browser by the time the click
		// returns, but revoking in the same task can still race it in Safari.
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
	}
	return true;
}
