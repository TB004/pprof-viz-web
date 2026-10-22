// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import type { ProfileService } from "#lib/profiles/profiles.svelte.js";
import {
	type CollectionStatus,
	type CollectionType,
	type Frame,
	type MetadataResponse,
	type ProfileRow,
	CollectionStatus as Status,
} from "#lib/types";
import { errorMessage, parseUrl, ulid } from "#lib/utils";
import type { SessionProfile, WorkerEvent } from "./worker.js";

/** Rolling window of samples kept in memory; the oldest are evicted. */
export const MAX_FRAMES = 500;

export interface CollectionState {
	status: CollectionStatus;
	collectedSamples: number;
	elapsedSeconds: number;
	/** True when the current data was loaded from the archive, not collected. */
	loaded: boolean;
	/** True once the current session has been written to the archive. */
	saved: boolean;
	/** Why the current session failed to start or stopped early. */
	error: string | null;
	selectedProfile?: string;
	selectedProfileLabel?: string;
	url?: URL;
	mode?: CollectionType;
	data?: Frame[];
	dataTimestamps?: number[];
	metadata?: MetadataResponse;
	startedAt?: number;
	endedAt?: number;
}

/** Everything the archive needs to persist the current session. */
export interface CollectionSnapshot {
	frames: Frame[];
	frameTimestamps: number[];
	metadata: MetadataResponse | null;
	profileName: string | null;
	profileUrl: string | null;
	mode: CollectionType | null;
	startedAt: number | undefined;
	endedAt: number | undefined;
}

export interface LoadedCollection {
	frames: Frame[];
	frameTimestamps: number[];
	metadata: MetadataResponse | null;
	profileUrl: string | null;
	mode: CollectionType | null;
	startedAt: number;
	durationMs: number;
}

/**
 * Main-thread handle on the collection worker. The worker is spawned on the
 * first `start` and kept for the tab's lifetime.
 */
class WorkerHandle {
	readonly #onEvent: (event: WorkerEvent) => void;
	#worker: Worker | undefined;

	constructor(onEvent: (event: WorkerEvent) => void) {
		this.#onEvent = onEvent;
	}

	#ensure(): Worker {
		if (this.#worker) return this.#worker;
		const worker = new Worker(new URL("./worker.ts", import.meta.url), {
			type: "module",
			name: "pprof-viz-collection",
		});
		worker.addEventListener("message", (event: MessageEvent<WorkerEvent>) =>
			this.#onEvent(event.data),
		);
		worker.addEventListener("error", (event) => {
			this.#onEvent({
				type: "failed",
				sessionId: "",
				message: `collection worker crashed: ${event.message}`,
			});
		});
		this.#worker = worker;
		return worker;
	}

	start(sessionId: string, profile: SessionProfile): void {
		this.#ensure().postMessage({ type: "start", sessionId, profile });
	}

	stop(sessionId: string): void {
		// No worker means no session to stop.
		if (this.#worker) this.#ensure().postMessage({ type: "stop", sessionId });
	}

	dispose(): void {
		this.#worker?.terminate();
		this.#worker = undefined;
	}
}

/**
 * A once-a-second ticker. The caller derives the figure from wall-clock rather
 * than counted ticks, so it stays right even when a backgrounded tab throttles
 * the interval down to once a minute.
 */
class ElapsedTimer {
	readonly #onTick: () => void;
	#handle: ReturnType<typeof setInterval> | undefined;

	constructor(onTick: () => void) {
		this.#onTick = onTick;
	}

	start(): void {
		if (this.#handle !== undefined) return;
		this.#onTick();
		this.#handle = setInterval(this.#onTick, 1000);
	}

	stop(): void {
		if (this.#handle === undefined) return;
		clearInterval(this.#handle);
		this.#handle = undefined;
	}
}

export class CollectionService {
	readonly #state: CollectionState;
	readonly #profiles: ProfileService;
	readonly #worker: WorkerHandle;
	readonly #timer: ElapsedTimer;
	/** Identifies the session frames are accepted for; anything else is stale. */
	#sessionId: string | null = null;

	constructor(profiles: ProfileService) {
		this.#profiles = profiles;
		this.#state = $state<CollectionState>({
			status: Status.Idle,
			collectedSamples: 0,
			elapsedSeconds: 0,
			loaded: false,
			saved: false,
			error: null,
		});
		this.#worker = new WorkerHandle((event) => this.#onWorkerEvent(event));
		this.#timer = new ElapsedTimer(() => this.#tick());
	}

	/**
	 * The live session state. Reactive: reads inside components re-run as frames
	 * arrive. Treat as read-only outside this class.
	 */
	getState(): CollectionState {
		return this.#state;
	}

	selectProfile(profileId?: string): void {
		const profile = profileId ? this.#profiles.find(profileId) : undefined;
		this.#state.selectedProfile = profile?.id;
		this.#state.selectedProfileLabel = profile?.name;
		this.#state.url = parseUrl(profile?.url);
		this.#state.mode = profile?.mode;
	}

	/**
	 * Start a session for the selected profile. Never throws: a failure lands in
	 * `error`, which the status bar shows for as long as nothing replaces it.
	 */
	async startCollection(): Promise<void> {
		const { selectedProfile } = this.#state;
		if (!selectedProfile) return;

		let profile: ProfileRow;
		try {
			// Read the stored row, not the catalog: the session must use what the
			// profile manager last saved.
			profile = await this.#profiles.get(selectedProfile);
		} catch (error) {
			this.#state.error = errorMessage(error);
			return;
		}

		const session: SessionProfile = {
			url: profile.url,
			token: profile.token,
			mode: profile.mode,
			intervalSeconds: profile.intervalSeconds,
			numberOfCycles: profile.numberOfCycles,
		};

		// A fresh start clears the dashboards; the previous session's frames go
		// with it, which is why saving is offered before starting another run.
		const sessionId = ulid();
		this.#sessionId = sessionId;
		Object.assign(this.#state, {
			status: Status.Running,
			collectedSamples: 0,
			elapsedSeconds: 0,
			loaded: false,
			saved: false,
			error: null,
			selectedProfile: profile.id,
			selectedProfileLabel: profile.name,
			url: parseUrl(profile.url),
			mode: profile.mode,
			data: [],
			dataTimestamps: [],
			metadata: undefined,
			startedAt: Date.now(),
			endedAt: undefined,
		} satisfies CollectionState);

		try {
			this.#worker.start(sessionId, session);
			this.#timer.start();
		} catch (error) {
			this.#state.status = Status.Idle;
			this.#timer.stop();
			this.#state.error = `Failed to start collection: ${errorMessage(error)}`;
		}
	}

	stopCollection(): void {
		if (this.#sessionId) this.#worker.stop(this.#sessionId);
	}

	snapshot(): CollectionSnapshot {
		const state = this.#state;
		return {
			frames: state.data ?? [],
			frameTimestamps: state.dataTimestamps ?? [],
			metadata: state.metadata ?? null,
			profileName: state.selectedProfileLabel ?? null,
			profileUrl: state.url?.toString() ?? null,
			mode: state.mode ?? null,
			startedAt: state.startedAt,
			endedAt: state.endedAt,
		};
	}

	/** Dismiss the last session failure. */
	clearError(): void {
		this.#state.error = null;
	}

	/** This exact session is archived — a collection's data never changes. */
	markSaved(): void {
		this.#state.saved = true;
	}

	/** Install an archived collection as the current, idle session. */
	installLoaded(loaded: LoadedCollection): void {
		// Retire any running session so its frames cannot land on top of these.
		if (this.#sessionId) this.#worker.stop(this.#sessionId);
		this.#sessionId = null;
		this.#timer.stop();

		Object.assign(this.#state, {
			status: Status.Idle,
			collectedSamples: loaded.frames.length,
			elapsedSeconds: Math.max(0, Math.floor(loaded.durationMs / 1000)),
			loaded: true,
			saved: false,
			error: null,
			data: loaded.frames,
			dataTimestamps: loaded.frameTimestamps,
			metadata: loaded.metadata ?? undefined,
			url: parseUrl(loaded.profileUrl),
			mode: loaded.mode ?? undefined,
			startedAt: loaded.startedAt,
			endedAt: loaded.startedAt + loaded.durationMs,
		});
	}

	cleanup(): void {
		this.#timer.stop();
		this.#worker.dispose();
		this.#sessionId = null;
	}

	#tick(): void {
		const { status, startedAt } = this.#state;
		if (status !== Status.Running || !startedAt) return;
		this.#state.elapsedSeconds = Math.max(
			0,
			Math.floor((Date.now() - startedAt) / 1000),
		);
	}

	#onWorkerEvent(event: WorkerEvent): void {
		// An empty session id marks a worker-level failure, which is never stale.
		if (event.sessionId && event.sessionId !== this.#sessionId) return;

		switch (event.type) {
			case "metadata":
				this.#state.metadata = event.metadata;
				break;
			case "frame":
				this.#appendFrame(event.frame, event.timestamp);
				break;
			case "failed":
				this.#state.error = errorMessage(event.message);
				break;
			case "ended":
				this.#endSession(event.endedAt);
				break;
		}
	}

	#appendFrame(frame: Frame, timestamp: number): void {
		const data = evictOldest([...(this.#state.data ?? []), frame]);
		this.#state.data = data;
		this.#state.dataTimestamps = evictOldest([
			...(this.#state.dataTimestamps ?? []),
			timestamp,
		]);
		this.#state.collectedSamples = data.length;
	}

	#endSession(endedAt: number): void {
		// Keep the frames — the dashboards stay inspectable after a run.
		this.#state.status = Status.Idle;
		this.#state.endedAt = endedAt;
		this.#state.elapsedSeconds = this.#state.startedAt
			? Math.max(0, Math.floor((endedAt - this.#state.startedAt) / 1000))
			: 0;
		this.#timer.stop();
	}
}

/** Drop the oldest entries in place so at most `MAX_FRAMES` remain. */
function evictOldest<T>(entries: T[]): T[] {
	if (entries.length > MAX_FRAMES)
		entries.splice(0, entries.length - MAX_FRAMES);
	return entries;
}
