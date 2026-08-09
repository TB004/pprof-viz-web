// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

// Frontend view of the Rust types.
//
// Anything Rust can describe to specta lives in the generated `$lib/bindings`
// and is re-exported from here — this file must not restate those shapes.
// What it does add is the part specta cannot express:
//
//   - the proto DTOs, which cross the boundary as `unknown` because the frames
//     are `serde_json::Value` on the Rust side
//   - value-level constants for the generated string-union enums, so app code
//     can say `CollectionType.Stream` instead of a bare "stream" literal

import type {
	CollectionStatus as CollectionStatusUnion,
	CollectionType as CollectionTypeUnion,
	CollectionStateSnapshot as GeneratedSnapshot,
	HttpVersion as HttpVersionUnion,
	ThemeMode as ThemeModeUnion,
} from "$lib/bindings";

export type {
	AppError,
	AppSettings,
	CollectionRow,
	DiskUsage,
	ProfileInput,
	ProfileRow,
	ProjectRow,
} from "$lib/bindings";

// --- enums ---
//
// specta emits Rust unit enums as string unions, which are types only. These
// constants give the same variants a value form. `satisfies` ties them to the
// generated union, so renaming or removing a variant in Rust fails the build
// here. (Adding one does not — the union simply grows.)

export const ThemeMode = {
	Light: "light",
	Dark: "dark",
	System: "system",
} as const satisfies Record<string, ThemeModeUnion>;
export type ThemeMode = ThemeModeUnion;

export const CollectionType = {
	Snapshot: "snapshot",
	Stream: "stream",
} as const satisfies Record<string, CollectionTypeUnion>;
export type CollectionType = CollectionTypeUnion;

export const HttpVersion = {
	Http2: "http2",
	Http3: "http3",
} as const satisfies Record<string, HttpVersionUnion>;
export type HttpVersion = HttpVersionUnion;

export const CollectionStatus = {
	Idle: "idle",
	Running: "running",
} as const satisfies Record<string, CollectionStatusUnion>;
export type CollectionStatus = CollectionStatusUnion;

// --- proto DTOs ---

// Proto3 JSON encodes uint64 as a string and double/uint32 as a number.
// The chart pages wrap accesses with `Number(... ?? 0)` so accepting both
// shapes here is enough — no need to normalize at the boundary.
type Numeric = number | string;

// Mirror of `proto::AllResponse` (and its sub-messages) as serialized to
// JSON by buffa. All fields are optional — proto3 omits unset values, and
// the streaming endpoint sends delta-encoded frames merged in Rust.

export interface CPUResponse {
	gcAssistSeconds?: number;
	gcDedicatedSeconds?: number;
	gcIdleSeconds?: number;
	gcPauseSeconds?: number;
	gcTotalSeconds?: number;
	idleSeconds?: number;
	totalSeconds?: number;
	userSeconds?: number;
	scavengeAssistSeconds?: number;
	scavengeBackgroundSeconds?: number;
	scavengeTotalSeconds?: number;
}

export interface SchedulerResponse {
	latenciesSeconds?: Histogram;
	stoppingGcSeconds?: Histogram;
	stoppingOtherSeconds?: Histogram;
	totalGcPauseSeconds?: Histogram;
	totalOtherPauseSeconds?: Histogram;
	goroutinesCreated?: Numeric;
	gomaxprocsThreads?: number;
	notInGoGoroutines?: number;
	runnableGoroutines?: number;
	runningGoroutines?: number;
	waitingGoroutines?: number;
	liveGoroutines?: number;
	totalLiveThreads?: number;
}

export interface GCResponse {
	bytesAllocsBySize?: Histogram;
	bytesFreesBySize?: Histogram;
	executedCleanups?: Numeric;
	queuedCleanups?: Numeric;
	automaticCycles?: Numeric;
	forcedCycles?: Numeric;
	totalCycles?: Numeric;
	executedFinalizers?: Numeric;
	queuedFinalizers?: Numeric;
	memoryLimitBytes?: Numeric;
	bytesAllocs?: Numeric;
	objectsAllocs?: Numeric;
	bytesFrees?: Numeric;
	objectsFrees?: Numeric;
	goalHeapSizeBytes?: Numeric;
	liveOccupiedBytes?: Numeric;
	objectsOccupied?: Numeric;
	tinyObjectsAllocs?: Numeric;
	limiterLastEnabledCycle?: Numeric;
	globalScannedBytes?: Numeric;
	heapScannedBytes?: Numeric;
	stackScannedBytes?: Numeric;
	totalScannedBytes?: Numeric;
	stackStartingSize?: Numeric;
	targetHeapSizePercentage?: number;
}

export interface MemoryResponse {
	heapFreeBytes?: Numeric;
	heapObjectBytes?: Numeric;
	heapReleasedBytes?: Numeric;
	heapStackBytes?: Numeric;
	heapUnusedBytes?: Numeric;
	mcacheFreeBytes?: Numeric;
	mcacheInuseBytes?: Numeric;
	mspanFreeBytes?: Numeric;
	mspanInuseBytes?: Numeric;
	otherMetadataBytes?: Numeric;
	osStackBytes?: Numeric;
	otherBytes?: Numeric;
	profilingBucketBytes?: Numeric;
	totalBytes?: Numeric;
}

export interface CgoResponse {
	cgoCalls?: Numeric;
}

export interface SyncResponse {
	totalMutexWaitDurationSeconds?: number;
}

export interface GoDebugResponse {
	[key: string]: Numeric | undefined;
}

export interface Histogram {
	counts?: Numeric[];
	buckets?: number[];
	updatedCounts?: Record<string, Numeric>;
}

export interface Frame {
	scheduler?: SchedulerResponse;
	goDebug?: GoDebugResponse;
	gc?: GCResponse;
	memory?: MemoryResponse;
	cpu?: CPUResponse;
	cgo?: CgoResponse;
	sync?: SyncResponse;
}

export interface MetadataResponse {
	gc?: {
		bytesAllocsBySizeBuckets?: number[];
		bytesFreesBySizeBuckets?: number[];
	};
	scheduler?: {
		latenciesSecondsBuckets?: number[];
		stoppingGcSecondsBuckets?: number[];
		stoppingOtherSecondsBuckets?: number[];
		totalGcPauseSecondsBuckets?: number[];
		totalOtherPauseSecondsBuckets?: number[];
	};
}

/**
 * The generated snapshot, with the two fields specta can only type as
 * `unknown` replaced by their real proto shapes.
 */
export type CollectionStateSnapshot = Omit<
	GeneratedSnapshot,
	"frames" | "metadata"
> & {
	frames: Frame[];
	metadata: MetadataResponse | null;
};

export const EVENT_FRAME = "collection://frame";
export const EVENT_STATE = "collection://state";
export const EVENT_METADATA = "collection://metadata";
export const EVENT_OPENED = "archive://opened";
