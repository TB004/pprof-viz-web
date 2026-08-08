// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

// Shared formatting helpers for metric pages.

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
