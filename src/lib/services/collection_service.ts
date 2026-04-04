import { type Readable, writable } from "svelte/store";
import { registerError } from "$lib/services/error_service.js";
import * as ProfileService from "./profile_service";

export type CollectionType = ProfileService.CollectionType;

export enum CollectionStatus {
	Idle = "idle",
	Running = "running",
}

export interface CollectionState {
	status: CollectionStatus;
	collectedSamples: number;
	elapsedSeconds: number;
	selectedProfile: string | undefined;
	selectedProfileLabel: string | undefined;
	url: URL | undefined;
	mode: ProfileService.CollectionType | undefined;
	params: Record<string, unknown>;
	data: unknown;
	metadata: unknown;
}

export function formatElapsedTime(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return `${hours}h ${minutes}m ${seconds}s`;
}

const defaultCollectionState: CollectionState = {
	status: CollectionStatus.Idle,
	collectedSamples: 0,
	elapsedSeconds: 0,
	selectedProfile: undefined,
	selectedProfileLabel: undefined,
	url: undefined,
	mode: undefined,
	params: {},
	data: null,
	metadata: null,
};

const collectionStateStore = writable<CollectionState>(defaultCollectionState);

let timerHandle: ReturnType<typeof setInterval> | undefined;
let collectionStartedAt: number | undefined;

function getCollectionStateSnapshot(): CollectionState {
	let snapshot = defaultCollectionState;
	const unsubscribe = collectionStateStore.subscribe((value) => {
		snapshot = value;
	});
	unsubscribe();
	return snapshot;
}

function applySelectedProfile(profileId: string | undefined) {
	const snapshot = profileId
		? ProfileService.getProfileById(profileId)
		: undefined;

	collectionStateStore.update((state) => ({
		...state,
		selectedProfile: snapshot?.profile.id,
		selectedProfileLabel: snapshot?.profile.name,
		url: snapshot ? new URL(snapshot.profile.url) : undefined,
		mode: snapshot?.profile.mode,
	}));
}

function updateElapsedTimeFromStart() {
	const startedAt = collectionStartedAt;
	if (startedAt === undefined) {
		return;
	}

	collectionStateStore.update((state) => ({
		...state,
		elapsedSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
	}));
}

export const collectionState: Readable<CollectionState> = {
	subscribe: collectionStateStore.subscribe,
};

export async function selectProfile(profileId: string | undefined) {
	const currentState = getCollectionStateSnapshot();
	if (
		currentState.status === CollectionStatus.Running &&
		profileId !== currentState.selectedProfile
	) {
		registerError(
			"Stop the current collection before changing the collection profile.",
		);
		return;
	}

	await ProfileService.setActiveProfile(profileId);
	applySelectedProfile(profileId);
}

export function startCollection() {
	const currentState = getCollectionStateSnapshot();

	if (currentState.url === undefined || currentState.mode === undefined) {
		registerError("Select a collection profile before starting a collection.");
		return;
	}

	collectionStartedAt = Date.now();
	collectionStateStore.update((state) => ({
		...state,
		status: CollectionStatus.Running,
		elapsedSeconds: 0,
		collectedSamples: 0,
		data: null,
		metadata: null,
	}));
	updateElapsedTimeFromStart();
	timerHandle = setInterval(updateElapsedTimeFromStart, 1000);
}

export function stopCollection() {
	updateElapsedTimeFromStart();
	collectionStateStore.update((state) => ({
		...state,
		status: CollectionStatus.Idle,
	}));

	if (timerHandle !== undefined) {
		clearInterval(timerHandle);
		timerHandle = undefined;
	}
	collectionStartedAt = undefined;
	collectionStateStore.set(defaultCollectionState);
}

export function getMetadata() {
	// TODO: Implement the logic to fetch metadata from the target application
}
