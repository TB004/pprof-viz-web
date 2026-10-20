// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { isAbort } from "./download.js";

interface OpenPickerOptions {
	multiple?: boolean;
	excludeAcceptAllOption?: boolean;
	types?: { description: string; accept: Record<string, string[]> }[];
}

interface Picker {
	showOpenFilePicker?: (
		options: OpenPickerOptions,
	) => Promise<FileSystemFileHandle[]>;
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
	const picker = (globalThis as Picker).showOpenFilePicker;
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
