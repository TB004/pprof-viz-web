// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

// Pure helpers with no platform dependency. The shadcn components under
// `components/ui` import `cn` and the `With*` types from here by name.

export { cn } from "cn";

export type WithoutChild<T> = T extends { child?: unknown }
	? Omit<T, "child">
	: T;

export type WithoutChildren<T> = T extends { children?: unknown }
	? Omit<T, "children">
	: T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;

export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
	ref?: U | null;
};

// --- formatting ---

export function fmtBytes(b: number): string {
	if (b === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(b) / Math.log(1024));
	return `${(b / 1024 ** i).toFixed(2)} ${units[i]}`;
}

/** Compact byte size for axis ticks, e.g. `19.1MB`. */
export function fmtBytesAxis(b: number): string {
	if (b === 0) return "0";
	if (b < 100) return `${b.toFixed(0)}B`;
	if (b < 100 * 1024) return `${(b / 1024).toFixed(1)}KB`;
	if (b < 100 * 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)}MB`;
	if (b < 100 * 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)}GB`;
	return `${(b / 1024 ** 4).toFixed(1)}TB`;
}

/** Compact count for axis ticks, e.g. `12.5K`, `3.4M`. */
export function fmtCountAxis(n: number): string {
	if (n !== Math.floor(n)) return "";
	if (n < 1_000) return String(n);
	if (n < 100_000) return `${(n / 1_000).toFixed(1)}K`;
	if (n < 100_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	return `${(n / 1_000_000_000).toFixed(1)}B`;
}

/** Human-readable duration from seconds, e.g. `1.250ms`, `2.500s`. */
export function fmtSecs(s: number): string {
	if (s === 0) return "0s";
	if (s < 0.001) return `${(s * 1_000_000).toFixed(0)}µs`;
	if (s < 1) return `${(s * 1_000).toFixed(2)}ms`;
	return `${s.toFixed(3)}s`;
}

/** Compact duration for axis ticks, scaling from µs up to hours. */
export function fmtSecsAxis(s: number): string {
	if (s === 0) return "0";
	if (s < 0.0001) return `${(s * 1_000_000).toFixed(0)}µs`;
	if (s < 0.1) return `${(s * 1_000).toFixed(1)}ms`;
	if (s < 60) return `${s.toFixed(1)}s`;
	if (s < 6000) return `${(s / 60).toFixed(1)}m`;
	return `${(s / 3600).toFixed(1)}h`;
}

/** A whole-second duration as `1h 2m 3s`. */
export function fmtElapsed(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${hours}h ${minutes}m ${seconds}s`;
}

/** A caught value as a sentence to show next to whatever failed. */
export function errorMessage(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.charAt(0).toUpperCase() + message.slice(1);
}

// --- text ---

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

/** A parsed URL, or undefined for anything `new URL` rejects. */
export function parseUrl(raw: string | null | undefined): URL | undefined {
	if (!raw) return undefined;
	try {
		return new URL(raw);
	} catch {
		return undefined;
	}
}

// --- ids ---

const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ULID_TIME_CHARS = 10;
const ULID_RANDOM_CHARS = 16;
/** Largest timestamp representable in 10 base32 characters (48 bits). */
const ULID_MAX_TIME = 2 ** 48 - 1;
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

let lastTime = -1;
const lastRandom = new Uint8Array(ULID_RANDOM_CHARS);

function encodeTime(time: number): string {
	let out = "";
	let rest = Math.min(Math.max(time, 0), ULID_MAX_TIME);
	for (let i = 0; i < ULID_TIME_CHARS; i++) {
		out = ULID_ALPHABET[rest % 32] + out;
		rest = Math.floor(rest / 32);
	}
	return out;
}

function nextRandom(sameMillisecond: boolean): void {
	if (!sameMillisecond) {
		crypto.getRandomValues(lastRandom);
		for (let i = 0; i < ULID_RANDOM_CHARS; i++) lastRandom[i] &= 0x1f;
		return;
	}
	// Monotonicity inside one millisecond: increment the random component as a
	// big-endian base32 number so ids minted back-to-back still sort correctly.
	for (let i = ULID_RANDOM_CHARS - 1; i >= 0; i--) {
		if (lastRandom[i] < 31) {
			lastRandom[i]++;
			return;
		}
		lastRandom[i] = 0;
	}
}

/** A new ULID, monotonically increasing even within the same millisecond. */
export function ulid(now = Date.now()): string {
	const time = Math.max(now, lastTime);
	nextRandom(time === lastTime);
	lastTime = time;

	let random = "";
	for (let i = 0; i < ULID_RANDOM_CHARS; i++) {
		random += ULID_ALPHABET[lastRandom[i]];
	}
	return encodeTime(time) + random;
}

/** True for a string in the Crockford base32 shape `ulid()` mints. */
export function isUlid(value: string): boolean {
	return ULID_PATTERN.test(value);
}
