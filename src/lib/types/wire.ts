// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

export type {
	AllResponse,
	CgoResponse,
	CollectionMeta,
	CPUResponse,
	GCMetadata,
	GCResponse,
	GoDebugResponse,
	Histogram,
	MemoryResponse,
	MetadataResponse,
	SchedulerMetadata,
	SchedulerResponse,
	StoredCollection,
	StreamConfigRequest,
	SyncResponse,
} from "$lib/proto/gen/collector_pb.js";

import type { AllResponse } from "$lib/proto/gen/collector_pb.js";

/** One merged sample: every group carries its full state, not a delta. */
export type Frame = AllResponse;

/**
 * The metric groups of a frame, in merge order. Kept explicit so merging is
 * driven by the schema's own field set rather than by whatever keys happen to
 * be present on a decoded message.
 */
export const FRAME_GROUPS = [
	"scheduler",
	"goDebug",
	"gc",
	"memory",
	"cpu",
	"cgo",
	"sync",
] as const satisfies ReadonlyArray<keyof AllResponse>;

export type FrameGroup = (typeof FRAME_GROUPS)[number];
