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

const KB = 1024;
const MB = 1024 ** 2;
const GB = 1024 ** 3;

/** A byte size for reading, e.g. `87.4 MB`. */
export function fmtBytes(b: number): string {
	if (b >= GB) return `${(b / GB).toFixed(2)} GB`;
	if (b >= MB) return `${(b / MB).toFixed(b >= 100 * MB ? 0 : 1)} MB`;
	if (b >= KB) return `${(b / KB).toFixed(1)} KB`;
	return `${Math.round(b)} B`;
}

/** Compact byte size for axis ticks, e.g. `19.1 MB`. */
export function fmtBytesAxis(b: number): string {
	if (b >= GB) return `${(b / GB).toFixed(1)} GB`;
	if (b >= MB) return `${Math.round((b / MB) * 10) / 10} MB`;
	if (b >= KB) return `${Math.round(b / KB)} KB`;
	return `${Math.round(b)} B`;
}

/** A count with thousands separators, e.g. `1,014`. */
export function fmtCount(n: number): string {
	return Math.round(n).toLocaleString("en-US");
}

/** Compact count for axis ticks and tight spots, e.g. `12k`, `3.4M`. */
export function fmtCountAxis(n: number): string {
	if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
	if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
	return String(Math.round(n * 10) / 10);
}

/** A duration in seconds for reading, scaling from µs to s, e.g. `12.3 ms`. */
export function fmtSecs(s: number): string {
	if (s >= 1) return `${s.toFixed(2)} s`;
	if (s >= 0.001) return `${(s * 1000).toFixed(s >= 0.01 ? 1 : 2)} ms`;
	return `${(s * 1e6).toFixed(0)} µs`;
}

/** Compact duration for axis ticks, e.g. `250µs`, `1.5s`. */
export function fmtSecsAxis(s: number): string {
	if (s === 0) return "0";
	if (s >= 1) return `${Math.round(s * 10) / 10}s`;
	if (s >= 0.001) return `${Math.round(s * 10000) / 10}ms`;
	return `${Math.round(s * 1e6)}µs`;
}

export function fmtPercent(n: number): string {
	return `${n.toFixed(1)}%`;
}

/** A whole-second duration as a clock reading, `mm:ss` or `h:mm:ss`. */
export function fmtClock(totalSeconds: number): string {
	const sec = Math.max(0, Math.round(totalSeconds));
	const pad = (v: number) => String(v).padStart(2, "0");
	const h = Math.floor(sec / 3600);
	const m = Math.floor(sec / 60) % 60;
	return `${h ? `${h}:${pad(m)}` : pad(m)}:${pad(sec % 60)}`;
}

/** A wall-clock time of day, `hh:mm:ss` on a 24-hour clock. */
export function fmtTimeOfDay(ms: number): string {
	return new Date(ms).toLocaleTimeString(undefined, {
		hourCycle: "h23",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

/** A date and time for listings, e.g. `Nov 2, 2026, 18:12`. */
export function fmtDateTime(ms: number): string {
	return new Date(ms).toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

// --- series ---

/**
 * Per-sample increments of a cumulative counter. The runtime reports totals
 * since process start; the dashboards chart what happened between samples.
 * The first sample has no predecessor, so it repeats the second's increment
 * rather than dipping to zero. A counter that goes backwards (a restarted
 * process) contributes nothing for that step.
 */
export function deltas(values: number[]): number[] {
	const out = values.map((v, i) =>
		i === 0 ? 0 : Math.max(0, v - values[i - 1]),
	);
	if (out.length > 1) out[0] = out[1];
	return out;
}

/** `deltas`, divided by the seconds between samples. */
export function ratesPerSecond(
	values: number[],
	timestamps: number[],
): number[] {
	const steps = deltas(values);
	return steps.map((d, i) => {
		const j = Math.max(1, i);
		const seconds = ((timestamps[j] ?? 0) - (timestamps[j - 1] ?? 0)) / 1000;
		return seconds > 0 ? d / seconds : d;
	});
}

/** "▲ 3.2% vs 10 samples ago", or a neutral note while there is no history. */
export function trendLabel(values: number[], span = 10): string {
	if (values.length <= span) return "latest sample";
	const before = values[values.length - 1 - span];
	const now = values[values.length - 1];
	if (!before) return "latest sample";
	const change = ((now - before) / Math.abs(before)) * 100;
	return `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}% vs ${span} samples ago`;
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
