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
