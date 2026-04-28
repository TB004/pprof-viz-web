import { Code, ConnectError } from "@connectrpc/connect";
import { type Readable, writable } from "svelte/store";
import type { AllResponse, MetadataResponse } from "$lib/proto/gen/agent_pb";
import { AgentService, ErrorService, ProfileService } from "$lib/services";

export type CollectionType = ProfileService.CollectionType;

export enum CollectionStatus {
	Idle = "idle",
	Running = "running",
}

export interface CollectionState {
	status: CollectionStatus;
	collectedSamples: number;
	elapsedSeconds: number;
	selectedProfile?: string;
	selectedProfileLabel?: string;
	url?: URL;
	mode?: ProfileService.CollectionType;
	data?: AllResponse[];
	metadata?: MetadataResponse;
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
	data: undefined,
	metadata: undefined,
};

const collectionStateStore = writable<CollectionState>(defaultCollectionState);

let timerHandle: ReturnType<typeof setInterval> | undefined;
let collectionStartedAt: number | undefined;
let streamAbortController: AbortController | undefined;

function getCollectionStateSnapshot(): CollectionState {
	let snapshot = defaultCollectionState;
	const unsubscribe = collectionStateStore.subscribe((value) => {
		snapshot = value;
	});
	unsubscribe();
	return snapshot;
}

function applySelectedProfile(profileId?: string) {
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

function isCancellation(err: unknown): boolean {
	if (err instanceof ConnectError && err.code === Code.Canceled) {
		return true;
	}
	if (err instanceof Error && err.name === "AbortError") {
		return true;
	}
	return false;
}

export const collectionState: Readable<CollectionState> = {
	subscribe: collectionStateStore.subscribe,
};

export async function selectProfile(profileId?: string): Promise<void> {
	const currentState = getCollectionStateSnapshot();
	if (
		currentState.status === CollectionStatus.Running &&
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

export async function startCollection(): Promise<void> {
	const state = getCollectionStateSnapshot();

	const profile = ProfileService.getProfileById(state.selectedProfile ?? "");

	collectionStateStore.update((s) => ({
		...s,
		status: CollectionStatus.Running,
		elapsedSeconds: 0,
		collectedSamples: 0,
		data: undefined,
		metadata: undefined,
	}));

	// Start timer
	collectionStartedAt = Date.now();
	updateElapsedTimeFromStart();
	timerHandle = setInterval(updateElapsedTimeFromStart, 1000);

	const agent = new AgentService(state.url?.toString() || "");

	// Fetch metadata in the background — failure is non-fatal.
	try {
		const metadata = await agent.getMetadata();
		collectionStateStore.update((s) => ({ ...s, metadata }));
	} catch (e) {
		ErrorService.registerError(`Failed to fetch Metadata: ${e}`);
		stopCollection();
		return;
	}

	// Fetch data
	try {
		if (state.mode === ProfileService.CollectionType.Snapshot) {
			const data = await agent.snapshotAll();
			collectionStateStore.update((s) => ({
				...s,
				data: [...(s.data ?? []), data],
				collectedSamples: 1,
			}));
		} else {
			const intervalSeconds = profile?.profile.intervalSeconds ?? 1;
			const numberOfCycles = profile?.profile.numberOfCycles ?? 0;

			streamAbortController = new AbortController();
			const stream = agent.streamAll(
				intervalSeconds,
				numberOfCycles,
				streamAbortController.signal,
			);

			for await (const frame of stream) {
				collectionStateStore.update((s) => ({
					...s,
					data: [...(s.data ?? []), frame],
					collectedSamples: s.collectedSamples + 1,
				}));
			}
		}
	} catch (err) {
		if (!isCancellation(err)) {
			ErrorService.registerError(
				err instanceof Error ? err.message : "Collection failed unexpectedly.",
			);
		}
	} finally {
		if (getCollectionStateSnapshot().status === CollectionStatus.Running) {
			stopCollection();
		}
	}
}

export function stopCollection() {
	if (streamAbortController) {
		streamAbortController.abort();
		streamAbortController = undefined;
	}

	// Stop timer
	if (timerHandle !== undefined) {
		clearInterval(timerHandle);
		timerHandle = undefined;
	}
	collectionStartedAt = undefined;

	collectionStateStore.update((state) => ({
		...state,
		status: CollectionStatus.Idle,
	}));

	// Deselect profile to reset collection parameters in the UI
	selectProfile(undefined);
}
