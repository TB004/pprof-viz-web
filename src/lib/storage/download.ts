// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

interface SavePickerOptions {
	suggestedName?: string;
	types?: { description: string; accept: Record<string, string[]> }[];
}

interface Picker {
	showSaveFilePicker?: (
		options: SavePickerOptions,
	) => Promise<FileSystemFileHandle>;
}

/** Thrown by the file pickers when the user closes the dialog. */
export function isAbort(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
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

	const picker = (globalThis as Picker).showSaveFilePicker;
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
