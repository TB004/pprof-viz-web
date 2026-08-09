// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { listen } from "@tauri-apps/api/event";
import { type Readable, writable } from "svelte/store";
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

const defaultCollectionState: CollectionState = {
	status: CollectionStatus.Idle,
	collectedSamples: 0,
	elapsedSeconds: 0,
	loaded: false,
	saved: false,
};

const collectionStateStore = writable<CollectionState>(defaultCollectionState);

export const collectionState: Readable<CollectionState> = {
	subscribe: collectionStateStore.subscribe,
};

let hydrated = false;
let timerHandle: ReturnType<typeof setInterval> | undefined;

export function formatElapsedTime(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${hours}h ${minutes}m ${seconds}s`;
}

function getSnapshot(): CollectionState {
	let snapshot = defaultCollectionState;
	const unsubscribe = collectionStateStore.subscribe((value) => {
		snapshot = value;
	});
	unsubscribe();
	return snapshot;
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
		collectionStateStore.update((state) => {
			if (state.status !== CollectionStatus.Running || !state.startedAt) {
				return state;
			}
			return {
				...state,
				elapsedSeconds: Math.max(
					0,
					Math.floor((Date.now() - state.startedAt) / 1000),
				),
			};
		});
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
	collectionStateStore.update((state) => {
		const startedAt = snapshot.startedAt ?? undefined;
		// A different startedAt means a different session — a fresh live run or a
		// collection loaded from disk. Loaded collections carry no per-frame
		// timestamps, so reuse of the previous session's would be misleading.
		const sessionChanged = startedAt !== state.startedAt;
		// Backend records per-frame arrival times; prefer them when present and
		// aligned (covers loaded collections and survives a page reload).
		const backendTimestamps =
			snapshot.frameTimestamps &&
			snapshot.frameTimestamps.length === snapshot.frames.length
				? snapshot.frameTimestamps
				: undefined;
		const next: CollectionState = {
			...state,
			status: asStatus(snapshot.status),
			loaded: snapshot.loaded,
			saved: snapshot.saved,
			collectedSamples: snapshot.sampleCount ?? 0,
			data: snapshot.frames,
			// Prefer backend timestamps; otherwise preserve live ones for the same
			// session and clear when frames reset or the session changed.
			dataTimestamps:
				backendTimestamps ??
				(snapshot.frames.length === 0 || sessionChanged
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
		return next;
	});
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
						collectionStateStore.update((state) => {
							const data = evictOldest([...(state.data ?? []), event.payload]);
							return {
								...state,
								data,
								dataTimestamps: evictOldest([
									...(state.dataTimestamps ?? []),
									Date.now(),
								]),
								collectedSamples: data.length,
							};
						});
					}),
					listen<MetadataResponse>(EVENT_METADATA, (event) => {
						collectionStateStore.update((state) => ({
							...state,
							metadata: event.payload,
						}));
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
		collectionStateStore.update((state) => ({
			...state,
			selectedProfile: undefined,
			selectedProfileLabel: undefined,
			url: undefined,
			mode: undefined,
		}));
		return;
	}

	const located = await ProfileService.getProfileById(profileId);
	if (!located) return;

	collectionStateStore.update((state) => ({
		...state,
		selectedProfile: located.id,
		selectedProfileLabel: located.name,
		url: asUrl(located.url),
		mode: located.mode,
	}));
}

export async function startCollection(): Promise<void> {
	const state = getSnapshot();
	if (!state.selectedProfile) return;
	try {
		await Ipc.startCollection(state.selectedProfile);
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
