// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import type { AllResponse } from "#lib/proto/gen/collector_pb.js";

export type {
	CollectionMeta,
	Histogram,
	MetadataResponse,
} from "#lib/proto/gen/collector_pb.js";

export const CollectionType = {
	Snapshot: "snapshot",
	Stream: "stream",
} as const;
export type CollectionType =
	(typeof CollectionType)[keyof typeof CollectionType];

export const CollectionStatus = {
	Idle: "idle",
	Running: "running",
} as const;
export type CollectionStatus =
	(typeof CollectionStatus)[keyof typeof CollectionStatus];

// --- records ---

export interface ProjectRow {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
}

/** A collection target: where to reach an agent and how to sample it. */
export interface ProfileRow {
	id: string;
	projectId: string;
	name: string;
	url: string;
	mode: CollectionType;
	token: string | null;
	intervalSeconds: number | null;
	numberOfCycles: number | null;
	createdAt: number;
	updatedAt: number;
}

export type ProfileInput = Omit<
	ProfileRow,
	"id" | "projectId" | "createdAt" | "updatedAt"
>;

/** Metadata for one archived `.ppvz` file; the payload lives in OPFS. */
export interface CollectionRow {
	id: string;
	name: string;
	description: string | null;
	filename: string;
	sizeBytes: number;
	durationMs: number;
	sampleCount: number;
	profileName: string | null;
	profileUrl: string | null;
	mode: CollectionType | null;
	createdAt: number;
}

// --- wire ---

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
