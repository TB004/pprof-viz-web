import { listen } from "@tauri-apps/api/event";
import { type Readable, writable } from "svelte/store";
import { browser } from "$app/environment";
import { commands } from "$lib/bindings";
import { ErrorService, ProfileService } from "$lib/services";
import {
	type CollectionStateSnapshot,
	CollectionStatus,
	type CollectionType,
	EVENT_FRAME,
	EVENT_METADATA,
	EVENT_STATE,
	type Frame,
	type MetadataResponse,
} from "$lib/types";
import { run } from "./invoke.js";

export interface CollectionState {
	status: CollectionStatus;
	collectedSamples: number;
	elapsedSeconds: number;
	selectedProfile?: string;
	selectedProfileLabel?: string;
	url?: URL;
	mode?: CollectionType;
	data?: Frame[];
	metadata?: MetadataResponse;
	startedAt?: number;
}

const defaultCollectionState: CollectionState = {
	status: CollectionStatus.Idle,
	collectedSamples: 0,
	elapsedSeconds: 0,
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
		const next: CollectionState = {
			...state,
			status: asStatus(snapshot.status),
			collectedSamples: snapshot.sampleCount ?? 0,
			data: snapshot.frames as Frame[],
			metadata: (snapshot.metadata as MetadataResponse | null) ?? undefined,
			startedAt,
			mode: snapshot.mode ?? undefined,
			url: asUrl(snapshot.profileUrl),
		};
		if (snapshot.profileId) {
			next.selectedProfile = snapshot.profileId;
			next.selectedProfileLabel = snapshot.profileName ?? undefined;
		}
		next.elapsedSeconds = startedAt
			? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
			: 0;
		return next;
	});
	if (asStatus(snapshot.status) === CollectionStatus.Running) {
		startElapsedTimer();
	} else {
		stopElapsedTimer();
	}
}

async function hydrate() {
	if (hydrated) return;
	hydrated = true;
	try {
		const snapshot = await run(commands.getCollectionSnapshot());
		applySnapshot(snapshot as unknown as CollectionStateSnapshot);
	} catch {
		hydrated = false;
	}
}

let unlisteners: Array<() => void> = [];

if (browser) {
	void hydrate();

	listen<CollectionStateSnapshot>(EVENT_STATE, (event) => {
		applySnapshot(event.payload);
	}).then((unlisten) => unlisteners.push(unlisten));

	listen<Frame>(EVENT_FRAME, (event) => {
		collectionStateStore.update((state) => ({
			...state,
			data: [...(state.data ?? []), event.payload],
			collectedSamples: (state.data?.length ?? 0) + 1,
		}));
	}).then((unlisten) => unlisteners.push(unlisten));

	listen<MetadataResponse>(EVENT_METADATA, (event) => {
		collectionStateStore.update((state) => ({
			...state,
			metadata: event.payload,
		}));
	}).then((unlisten) => unlisteners.push(unlisten));
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
		await run(commands.startCollection(state.selectedProfile));
	} catch (e) {
		await ErrorService.registerError(
			e instanceof Error ? e.message : `Failed to start collection: ${e}`,
		);
	}
}

export async function stopCollection(): Promise<void> {
	try {
		await run(commands.stopCollection());
	} catch (e) {
		await ErrorService.registerError(
			e instanceof Error ? e.message : `Failed to stop collection: ${e}`,
		);
	}
}
