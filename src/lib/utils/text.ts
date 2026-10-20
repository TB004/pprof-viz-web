// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

/** Trim an optional user-supplied string, treating a blank result as absent. */
export function trimToNull(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

/** Trim and reject a blank value, naming the field in the thrown error. */
export function requireText(value: string, field: string): string {
	const trimmed = value.trim();
	if (!trimmed) throw new Error(`${field} must not be empty`);
	return trimmed;
}

/**
 * Turn a user-chosen name into something every filesystem accepts, falling
 * back when nothing usable is left. Reserved characters, path separators and
 * leading dots all go, so the result can never escape a download directory.
 */
export function safeFilename(name: string, fallback: string): string {
	const cleaned = name
		// biome-ignore lint/suspicious/noControlCharactersInRegex: a filename must not carry control characters
		.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, " ")
		.replace(/\s+/g, " ")
		.replace(/^\.+/, "")
		.trim()
		.slice(0, 100)
		.replace(/\.+$/, "")
		.trim();
	return cleaned || fallback;
}

/** A sortable `yyyymmdd-hhmm` stamp for generated filenames, in local time. */
export function filenameStamp(at = new Date()): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	return [
		at.getFullYear(),
		pad(at.getMonth() + 1),
		pad(at.getDate()),
		"-",
		pad(at.getHours()),
		pad(at.getMinutes()),
	].join("");
}
