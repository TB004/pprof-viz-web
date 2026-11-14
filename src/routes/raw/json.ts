// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { isHistogram } from "#lib/session/frames.js";
import type { Frame, FrameGroup, MetadataResponse } from "#lib/types";

/**
 * One response group of a frame as plain data. Decoded messages carry a
 * `$typeName` marker that is not payload, and histograms stream counts only:
 * their bucket boundaries come from the metadata (keyed `<field>Buckets`), so
 * they are paired back up here to show the full distribution.
 */
export function groupPayload(
	frame: Frame,
	group: FrameGroup,
	metadata: MetadataResponse | undefined,
): Record<string, unknown> {
	const raw = frame[group] as Record<string, unknown> | undefined;
	const meta = (metadata as Record<string, unknown> | undefined)?.[group] as
		| Record<string, number[] | undefined>
		| undefined;
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(raw ?? {})) {
		if (value === undefined || value === null || key.startsWith("$")) continue;
		if (isHistogram(value)) {
			const buckets = value.buckets.length
				? value.buckets
				: meta?.[`${key}Buckets`];
			out[key] = { counts: value.counts, buckets: buckets ?? [] };
		} else {
			out[key] = value;
		}
	}
	return out;
}

/**
 * `JSON.stringify` refuses `uint64` fields, which decode as bigint; writing
 * them as strings matches proto3 JSON.
 */
export function toJson(value: unknown): string {
	return JSON.stringify(
		value,
		(_key, v) => (typeof v === "bigint" ? v.toString() : v),
		2,
	);
}

export type JsonLine = {
	depth: number;
	key: string;
	value: string;
	kind: "number" | "string" | "array" | "punct";
};

/** Pretty-printed lines, typed so each value can be coloured. Arrays stay on one line. */
export function jsonLines(value: unknown): JsonLine[] {
	const lines: JsonLine[] = [];
	const scalar = (v: unknown) =>
		typeof v === "string" || typeof v === "bigint" ? `"${v}"` : String(v);

	function walk(v: unknown, depth: number, key: string, last: boolean) {
		const comma = last ? "" : ",";
		const label = key ? `"${key}": ` : "";
		if (Array.isArray(v)) {
			lines.push({
				depth,
				key: label,
				value: `[${v.map((item) => String(item)).join(", ")}]${comma}`,
				kind: "array",
			});
		} else if (v && typeof v === "object") {
			lines.push({ depth, key: label, value: "{", kind: "punct" });
			const entries = Object.entries(v);
			entries.forEach(([k, item], i) => {
				walk(item, depth + 1, k, i === entries.length - 1);
			});
			lines.push({ depth, key: "", value: `}${comma}`, kind: "punct" });
		} else {
			lines.push({
				depth,
				key: label,
				value: `${scalar(v)}${comma}`,
				kind:
					typeof v === "string" || typeof v === "bigint" ? "string" : "number",
			});
		}
	}

	walk(value, 0, "", true);
	return lines;
}
