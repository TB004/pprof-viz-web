// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { CollectionWorkerHandle } from "$lib/collection/client.js";
import type { SessionProfile, WorkerEvent } from "$lib/collection/protocol.js";
import {
	type CollectionStatus,
	type CollectionType,
	type Frame,
	type MetadataResponse,
	CollectionStatus as Status,
} from "$lib/types";
import { ulid } from "$lib/utils";
import type { ErrorService } from "./error_service.svelte.js";
import type { ProfileService } from "./profile_service.svelte.js";

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
	readonly #errors: ErrorService;
	readonly #worker: CollectionWorkerHandle;
	readonly #timer: ElapsedTimer;
	/** Identifies the session frames are accepted for; anything else is stale. */
	#sessionId: string | null = null;

	constructor(profiles: ProfileService, errors: ErrorService) {
		this.#profiles = profiles;
		this.#errors = errors;
		this.#state = $state<CollectionState>({
			status: Status.Idle,
			collectedSamples: 0,
			elapsedSeconds: 0,
			loaded: false,
			saved: false,
		});
		this.#worker = new CollectionWorkerHandle((event) =>
			this.#onWorkerEvent(event),
		);
		this.#timer = new ElapsedTimer(() => this.#tick());
	}

	/**
	 * The live session state. Reactive: reads inside components re-run as frames
	 * arrive. Treat as read-only outside this class.
	 */
	getState(): CollectionState {
		return this.#state;
	}

	async selectProfile(profileId?: string): Promise<void> {
		if (!profileId) {
			this.#state.selectedProfile = undefined;
			this.#state.selectedProfileLabel = undefined;
			this.#state.url = undefined;
			this.#state.mode = undefined;
			return;
		}

		const profile = await this.#profiles.getProfileById(profileId);
		if (!profile) return;

		this.#state.selectedProfile = profile.id;
		this.#state.selectedProfileLabel = profile.name;
		this.#state.url = parseUrl(profile.url);
		this.#state.mode = profile.mode;
	}

	async startCollection(): Promise<void> {
		const { selectedProfile } = this.#state;
		if (!selectedProfile) return;

		const profile = await this.#profiles.getProfileById(selectedProfile);
		if (!profile) {
			this.#errors.registerError(
				`Profile "${selectedProfile}" no longer exists`,
			);
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
			this.#errors.reportFailure("Failed to start collection", error);
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
				this.#errors.registerError(event.message);
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

export function formatElapsedTime(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${hours}h ${minutes}m ${seconds}s`;
}

function parseUrl(raw: string | null | undefined): URL | undefined {
	if (!raw) return undefined;
	try {
		return new URL(raw);
	} catch {
		return undefined;
	}
}

/** Drop the oldest entries in place so at most `MAX_FRAMES` remain. */
function evictOldest<T>(entries: T[]): T[] {
	if (entries.length > MAX_FRAMES)
		entries.splice(0, entries.length - MAX_FRAMES);
	return entries;
}
