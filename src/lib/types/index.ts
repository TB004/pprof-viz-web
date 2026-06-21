// Hand-written DTOs that mirror the Rust side (`src-tauri/src/`).
//
// Keep in sync with the corresponding `#[derive(Serialize, Deserialize)]`
// structs. Field names use camelCase because every Rust DTO is annotated
// with `#[serde(rename_all = "camelCase")]`.

// --- settings.rs ---

export enum ThemeMode {
	Light = "light",
	Dark = "dark",
	System = "system",
}

export enum CollectionType {
	Snapshot = "snapshot",
	Stream = "stream",
}

export enum HttpVersion {
	Http2 = "http2",
	Http3 = "http3",
}

export interface AppSettings {
	theme: ThemeMode;
	defaultName: string;
	defaultUrl: string;
	defaultMode: CollectionType;
	defaultIntervalSeconds: number;
	defaultNumberOfCycles: number;
	defaultHttpVersion: HttpVersion;
}

// --- collection.rs ---

export enum CollectionStatus {
	Idle = "idle",
	Running = "running",
}

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

export interface CollectionStateSnapshot {
	status: CollectionStatus;
	profileId: string | null;
	profileName: string | null;
	profileUrl: string | null;
	mode: CollectionType | null;
	startedAt: number | null;
	endedAt: number | null;
	loaded: boolean;
	saved: boolean;
	sampleCount: number | null;
	frames: Frame[];
	frameTimestamps: number[] | null;
	metadata: MetadataResponse | null;
}

export const EVENT_FRAME = "collection://frame";
export const EVENT_STATE = "collection://state";
export const EVENT_METADATA = "collection://metadata";
export const EVENT_OPENED = "archive://opened";

// --- db.rs ---

export interface ProjectRow {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
}

// --- archive.rs ---

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
	mode: string | null;
	createdAt: number;
}

export interface DiskUsage {
	collectionsBytes: number;
	freeBytes: number;
	totalBytes: number;
}

export interface ProfileRow {
	id: string;
	projectId: string;
	name: string;
	url: string;
	mode: CollectionType;
	httpVersion: HttpVersion;
	token: string | null;
	intervalSeconds: number | null;
	numberOfCycles: number | null;
	createdAt: number;
	updatedAt: number;
}

export interface ProfileInput {
	name: string;
	url: string;
	mode: CollectionType;
	httpVersion: HttpVersion;
	token: string | null;
	intervalSeconds: number | null;
	numberOfCycles: number | null;
}
