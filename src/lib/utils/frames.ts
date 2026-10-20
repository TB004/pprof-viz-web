// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { create } from "@bufbuild/protobuf";
import { HistogramSchema } from "#lib/proto/gen/collector_pb.js";
import { FRAME_GROUPS, type Frame, type Histogram } from "#lib/types";

/** A frame group (`gc`, `scheduler`, …) as an addressable field bag. */
type Group = Record<string, unknown>;

/** True when a decoded field is a `proto.Histogram`. */
export function isHistogram(value: unknown): value is Histogram {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { $typeName?: string }).$typeName === HistogramSchema.typeName
	);
}

/** Fold a streamed histogram into a dense `counts` array. */
function mergeHistogram(
	prev: Histogram | undefined,
	next: Histogram,
): Histogram {
	const counts = new Map<number, bigint>();
	let buckets: number[] = [];

	for (const source of prev ? [prev, next] : [next]) {
		source.counts.forEach((count, index) => {
			counts.set(index, count);
		});
		for (const [index, count] of Object.entries(source.updatedCounts)) {
			counts.set(Number(index), count);
		}
		if (source.buckets.length > 0) buckets = source.buckets;
	}

	// Gaps stay zero: a bucket only present in a shorter dense array is absent,
	// not carried over as undefined.
	const length = counts.size === 0 ? 0 : Math.max(...counts.keys()) + 1;
	const dense = new Array<bigint>(length).fill(0n);
	for (const [index, count] of counts) dense[index] = count;

	return create(HistogramSchema, { counts: dense, buckets });
}

/** Merge one group, folding histograms and overwriting set scalars. */
function mergeGroup(prev: unknown, next: unknown): unknown {
	if (next === undefined) return prev;
	if (prev === undefined) return next;
	if (typeof next !== "object" || next === null) return next;

	const merged: Group = { ...(prev as Group) };
	for (const [field, value] of Object.entries(next as Group)) {
		// Protobuf presence: an unset optional scalar decodes to `undefined`,
		// which means "unchanged" and must not clobber the carried value.
		if (value === undefined) continue;
		if (isHistogram(value)) {
			const carried = merged[field];
			merged[field] = mergeHistogram(
				isHistogram(carried) ? carried : undefined,
				value,
			);
		} else {
			merged[field] = value;
		}
	}
	return merged;
}

/** Fold a sparse wire frame onto the previous merged frame. */
export function mergeFrame(prev: Frame | null, next: Frame): Frame {
	const merged: Group = prev ? { ...(prev as unknown as Group) } : {};
	for (const group of FRAME_GROUPS) {
		const value = mergeGroup(merged[group], (next as unknown as Group)[group]);
		if (value !== undefined) merged[group] = value;
	}
	merged.$typeName = next.$typeName;
	return merged as unknown as Frame;
}

/**
 * Reduce a dense histogram to a sparse `updatedCounts` delta against the
 * previous frame's counts. Returns `undefined` when nothing changed, so the
 * replay carries the previous distribution forward untouched.
 */
function histogramDelta(
	prev: Histogram | undefined,
	next: Histogram,
): Histogram | undefined {
	const updatedCounts: Record<number, bigint> = {};
	let changed = false;
	next.counts.forEach((count, index) => {
		const before = prev?.counts[index];
		if (before === undefined ? count !== 0n : before !== count) {
			updatedCounts[index] = count;
			changed = true;
		}
	});
	if (!changed) return undefined;
	// `buckets` live once in the collection metadata, so they are dropped here.
	return create(HistogramSchema, { updatedCounts });
}

/**
 * Copy a group verbatim minus histogram `buckets`, which are stored once in
 * the collection metadata. Used for the first frame, which stays dense.
 */
function stripBuckets(next: unknown): unknown {
	if (typeof next !== "object" || next === null) return next;
	const out: Group = {};
	for (const [field, value] of Object.entries(next as Group)) {
		if (value === undefined) continue;
		out[field] = isHistogram(value)
			? create(HistogramSchema, {
					counts: value.counts,
					updatedCounts: value.updatedCounts,
				})
			: value;
	}
	return out;
}

/** Diff one group; returns `undefined` when no field moved. */
function diffGroup(prev: unknown, next: unknown): unknown {
	if (next === undefined) return undefined;
	if (typeof next !== "object" || next === null) {
		return next === prev ? undefined : next;
	}

	const before = (
		typeof prev === "object" && prev !== null ? prev : {}
	) as Group;
	const out: Group = {};
	let changed = false;
	for (const [field, value] of Object.entries(next as Group)) {
		if (value === undefined) continue;
		if (field === "$typeName") continue;
		if (isHistogram(value)) {
			const carried = before[field];
			const delta = histogramDelta(
				isHistogram(carried) ? carried : undefined,
				value,
			);
			if (delta !== undefined) {
				out[field] = delta;
				changed = true;
			}
		} else if (before[field] !== value) {
			out[field] = value;
			changed = true;
		}
	}
	if (!changed) return undefined;
	out.$typeName = (next as Group).$typeName;
	return out;
}

/**
 * Build a sparse wire-style frame from two consecutive merged frames. `prev`
 * is `null` for the first frame, which stays dense apart from bucket arrays.
 */
export function diffFrame(prev: Frame | null, next: Frame): Frame {
	const out: Group = { $typeName: next.$typeName };
	for (const group of FRAME_GROUPS) {
		const source = (next as unknown as Group)[group];
		if (source === undefined) continue;
		// The first frame has nothing to diff against and is kept dense so a
		// reader can rebuild the distribution without replaying earlier frames.
		const value = prev
			? diffGroup((prev as unknown as Group)[group], source)
			: stripBuckets(source);
		if (value !== undefined) out[group] = value;
	}
	return out as unknown as Frame;
}
