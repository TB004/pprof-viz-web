// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { CollectionType, HttpVersion } from "$lib/types";

export type Scheme = "http" | "https";

export const modeOptions: Array<{
	value: CollectionType;
	title: string;
	description: string;
}> = [
	{
		value: CollectionType.Snapshot,
		title: "Snapshot",
		description: "Capture a focused point-in-time profile.",
	},
	{
		value: CollectionType.Stream,
		title: "Stream",
		description: "Continuously follow runtime changes.",
	},
];

export const schemeOptions: Array<{ value: Scheme; label: string }> = [
	{ value: "http", label: "http://" },
	{ value: "https", label: "https://" },
];

export const httpVersionOptions: Array<{
	value: HttpVersion;
	label: string;
	requiresHttps: boolean;
}> = [
	{ value: HttpVersion.Http2, label: "HTTP/2", requiresHttps: false },
	{ value: HttpVersion.Http3, label: "HTTP/3", requiresHttps: true },
];

/** Split a stored URL into the parts the URL field edits. */
export function parseUrl(url: string): { scheme: Scheme; host: string } {
	// Tolerates a scheme-only value like "https://", which `new URL` rejects.
	const m = url.match(/^(https?):\/\/([^/]*)/);
	if (m) return { scheme: m[1] as Scheme, host: m[2] };
	return { scheme: "http", host: "" };
}

/** Inverse of {@link parseUrl}. */
export function buildUrl(scheme: Scheme, host: string): string {
	return `${scheme}://${host.trim()}`;
}
