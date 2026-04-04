import { type Readable, writable } from "svelte/store";
import { ErrorService } from "$lib/services/error_service.js";
import {
	CollectionType,
	getProfileById,
	ProfileService,
} from "./profile_service";

export { CollectionType };

export type CollectionStatus = "idle" | "running";

export interface CollectionState {
	status: CollectionStatus;
	collectedSamples: number;
	elapsedSeconds: number;
	selectedProfile: string | undefined;
	selectedProfileLabel: string | undefined;
	url: URL | undefined;
	mode: CollectionType | undefined;
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
	status: "idle",
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
	const snapshot = profileId ? getProfileById(profileId) : undefined;

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

export class CollectionService {
	static subscribe = collectionStateStore.subscribe;

	static async selectProfile(profileId: string | undefined) {
		const currentState = getCollectionStateSnapshot();
		if (
			currentState.status === "running" &&
			profileId !== currentState.selectedProfile
		) {
			ErrorService.registerError(
				"Stop the current collection before changing the collection profile.",
			);
			return;
		}

		await ProfileService.setActiveProfile(profileId);
		applySelectedProfile(profileId);
	}

	static startCollection() {
		const currentState = getCollectionStateSnapshot();

		if (currentState.url === undefined || currentState.mode === undefined) {
			ErrorService.registerError(
				"Select a collection profile before starting a collection.",
			);
			return;
		}

		collectionStartedAt = Date.now();
		collectionStateStore.update((state) => ({
			...state,
			status: "running",
			elapsedSeconds: 0,
			collectedSamples: 0,
			data: null,
			metadata: null,
		}));
		updateElapsedTimeFromStart();
		timerHandle = setInterval(updateElapsedTimeFromStart, 1000);
	}

	static stopCollection() {
		updateElapsedTimeFromStart();
		collectionStateStore.update((state) => ({
			...state,
			status: "idle",
		}));

		if (timerHandle !== undefined) {
			clearInterval(timerHandle);
			timerHandle = undefined;
		}
		collectionStartedAt = undefined;
		collectionStateStore.set(defaultCollectionState);
	}

	static getMetadata() {
		// TODO: Implement the logic to fetch metadata from the target application
	}
}
