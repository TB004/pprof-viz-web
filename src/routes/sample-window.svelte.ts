// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

// How many of the newest samples the dashboards chart. Shared, so moving
// between dashboards keeps the same window.

export const WINDOW_OPTIONS = [
	{ value: 30, label: "30" },
	{ value: 60, label: "60" },
	{ value: 120, label: "120" },
	{ value: 0, label: "All" },
];

/** `size` 0 means every sample in the buffer. */
export const sampleWindow = $state({ size: 60 });

/** The newest rows that fall inside the window. */
export function windowed<T>(rows: T[]): T[] {
	return sampleWindow.size ? rows.slice(-sampleWindow.size) : rows;
}
