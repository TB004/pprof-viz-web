// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { listen } from "@tauri-apps/api/event";
import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { MAX_FRAMES } from "$lib/bindings";
import * as Ipc from "$lib/ipc";
import { ErrorService, ProfileService } from "$lib/services";
import {
	type CollectionStateSnapshot,
	CollectionStatus,
	type CollectionType,
	EVENT_FRAME,
	EVENT_METADATA,
	EVENT_OPENED,
	EVENT_STATE,
	type Frame,
	type MetadataResponse,
} from "$lib/types";

export interface CollectionState {
	status: CollectionStatus;
	collectedSamples: number;
	elapsedSeconds: number;
	/** True when the current data was loaded from disk, not collected live. */
	loaded: boolean;
	/** True once the current session has been saved to the archive. */
	saved: boolean;
	selectedProfile?: string;
	selectedProfileLabel?: string;
	url?: URL;
	mode?: CollectionType;
	data?: Frame[];
	dataTimestamps?: number[];
	metadata?: MetadataResponse;
	startedAt?: number;
}

/**
 * The live session state. Reactive: reads inside components re-run as frames
 * arrive. Treat as read-only outside this module.
 */
export const collectionState: CollectionState = $state({
	status: CollectionStatus.Idle,
	collectedSamples: 0,
	elapsedSeconds: 0,
	loaded: false,
	saved: false,
});

let hydrated = false;
let timerHandle: ReturnType<typeof setInterval> | undefined;

export function formatElapsedTime(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${hours}h ${minutes}m ${seconds}s`;
}

function asStatus(raw: CollectionStateSnapshot["status"]): CollectionStatus {
	return raw === "running" ? CollectionStatus.Running : CollectionStatus.Idle;
}

/**
 * Drop the oldest entries in place so at most `MAX_FRAMES` remain, mirroring
 * the eviction Rust performs on its own buffer.
 */
function evictOldest<T>(entries: T[]): T[] {
	if (entries.length > MAX_FRAMES) {
		entries.splice(0, entries.length - MAX_FRAMES);
	}
	return entries;
}

function asUrl(raw: string | null | undefined): URL | undefined {
	if (!raw) return undefined;
	try {
		return new URL(raw);
	} catch {
		return undefined;
	}
}

function startElapsedTimer() {
	if (timerHandle !== undefined) return;
	const tick = () => {
		const { status, startedAt } = collectionState;
		if (status !== CollectionStatus.Running || !startedAt) return;
		collectionState.elapsedSeconds = Math.max(
			0,
			Math.floor((Date.now() - startedAt) / 1000),
		);
	};
	tick();
	timerHandle = setInterval(tick, 1000);
}

function stopElapsedTimer() {
	if (timerHandle !== undefined) {
		clearInterval(timerHandle);
		timerHandle = undefined;
	}
}

function applySnapshot(snapshot: CollectionStateSnapshot) {
	const state = collectionState;
	const startedAt = snapshot.startedAt ?? undefined;
	// A different startedAt means a different session — a fresh live run or a
	// collection loaded from disk. Loaded collections carry no per-frame
	// timestamps, so reuse of the previous session's would be misleading.
	const sessionChanged = startedAt !== state.startedAt;
	// A state event without frames means "unchanged, you already have them";
	// only a new session invalidates what we hold.
	const frames = snapshot.frames ?? (sessionChanged ? [] : (state.data ?? []));
	// Backend records per-frame arrival times; prefer them when present and
	// aligned (covers loaded collections and survives a page reload).
	const backendTimestamps =
		snapshot.frameTimestamps &&
		snapshot.frameTimestamps.length === frames.length
			? snapshot.frameTimestamps
			: undefined;
	const next: CollectionState = {
		...state,
		status: asStatus(snapshot.status),
		loaded: snapshot.loaded,
		saved: snapshot.saved,
		collectedSamples: snapshot.sampleCount ?? 0,
		data: frames,
		// Prefer backend timestamps; otherwise preserve live ones for the same
		// session and clear when frames reset or the session changed.
		dataTimestamps:
			backendTimestamps ??
			(frames.length === 0 || sessionChanged
				? undefined
				: state.dataTimestamps),
		metadata: snapshot.metadata ?? undefined,
		startedAt,
		mode: snapshot.mode ?? undefined,
		url: asUrl(snapshot.profileUrl),
	};
	if (snapshot.profileId) {
		next.selectedProfile = snapshot.profileId;
		next.selectedProfileLabel = snapshot.profileName ?? undefined;
	}
	// A stopped or loaded session has an endedAt — freeze elapsed at its
	// actual duration instead of counting wall-clock since startedAt.
	const endTime = snapshot.endedAt ?? Date.now();
	next.elapsedSeconds = startedAt
		? Math.max(0, Math.floor((endTime - startedAt) / 1000))
		: 0;
	Object.assign(collectionState, next);
	if (asStatus(snapshot.status) === CollectionStatus.Running) {
		startElapsedTimer();
	} else {
		stopElapsedTimer();
	}
}

let unlisteners: Array<() => void> = [];

if (browser) {
	void (async () => {
		try {
			// Register listeners before fetching the initial snapshot so no
			// events are missed between the two operations.
			const [unlistenState, unlistenFrame, unlistenMetadata, unlistenOpened] =
				await Promise.all([
					listen<CollectionStateSnapshot>(EVENT_STATE, (event) => {
						applySnapshot(event.payload);
					}),
					listen<Frame>(EVENT_FRAME, (event) => {
						const data = evictOldest([
							...(collectionState.data ?? []),
							event.payload,
						]);
						collectionState.data = data;
						collectionState.dataTimestamps = evictOldest([
							...(collectionState.dataTimestamps ?? []),
							Date.now(),
						]);
						collectionState.collectedSamples = data.length;
					}),
					listen<MetadataResponse>(EVENT_METADATA, (event) => {
						collectionState.metadata = event.payload;
					}),
					// A double-clicked .ppvz file was loaded — jump to a metric page
					// (warm start only; cold start lands on home with data hydrated).
					listen(EVENT_OPENED, () => {
						void goto("/cpu");
					}),
				]);
			unlisteners.push(
				unlistenState,
				unlistenFrame,
				unlistenMetadata,
				unlistenOpened,
			);
		} catch (e) {
			void ErrorService.registerError(
				`Failed to register collection listeners: ${e}`,
			);
			return;
		}

		if (!hydrated) {
			hydrated = true;
			try {
				const snapshot = await Ipc.getCollectionSnapshot();
				applySnapshot(snapshot);
			} catch (e) {
				hydrated = false;
				void ErrorService.registerError(
					`Failed to load collection state: ${e}`,
				);
			}
		}
	})();
}

export function cleanup() {
	for (const unlisten of unlisteners) unlisten();
	unlisteners = [];
	stopElapsedTimer();
}

export async function selectProfile(profileId?: string): Promise<void> {
	if (!profileId) {
		collectionState.selectedProfile = undefined;
		collectionState.selectedProfileLabel = undefined;
		collectionState.url = undefined;
		collectionState.mode = undefined;
		return;
	}

	const located = await ProfileService.getProfileById(profileId);
	if (!located) return;

	collectionState.selectedProfile = located.id;
	collectionState.selectedProfileLabel = located.name;
	collectionState.url = asUrl(located.url);
	collectionState.mode = located.mode;
}

export async function startCollection(): Promise<void> {
	const { selectedProfile } = collectionState;
	if (!selectedProfile) return;
	try {
		await Ipc.startCollection(selectedProfile);
	} catch (e) {
		await ErrorService.registerError(
			e instanceof Error ? e.message : `Failed to start collection: ${e}`,
		);
	}
}

export async function stopCollection(): Promise<void> {
	try {
		await Ipc.stopCollection();
	} catch (e) {
		await ErrorService.registerError(
			e instanceof Error ? e.message : `Failed to stop collection: ${e}`,
		);
	}
}
