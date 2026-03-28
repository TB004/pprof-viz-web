import { writable, type Readable } from "svelte/store";

export enum CollectionType {
	Snapshot = "snapshot",
	Stream = "stream",
}

export type CollectionStatus = "idle" | "running";

export interface CollectionProfile {
	value: string;
	label: string;
	url: URL;
	mode: CollectionType;
}

// These are currently just some hardcoded dummy data
export const collectionProfiles: CollectionProfile[] = [
	{
		value: "p1",
		label: "Profile 1",
		url: new URL("http://localhost:9090"),
		mode: CollectionType.Stream,
	},
	{
		value: "p2",
		label: "Profile 2",
		url: new URL("http://localhost:9091"),
		mode: CollectionType.Snapshot,
	},
	{
		value: "p3",
		label: "Profile 3",
		url: new URL("http://localhost:9092"),
		mode: CollectionType.Stream,
	},
];

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

function updateElapsedTimeFromStart() {
	if (collectionStartedAt === undefined) {
		return;
	}

	const elapsedSeconds = Math.max(
		0,
		Math.floor((Date.now() - collectionStartedAt) / 1000),
	);

	collectionStateStore.update((state) => ({
		...state,
		elapsedSeconds,
	}));
}

export function formatElapsedTime(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return `${hours}h ${minutes}m ${seconds}s`;
}

export const collectionState: Readable<CollectionState> = {
	subscribe: collectionStateStore.subscribe,
};

function getCollectionStateSnapshot(): CollectionState {
	let snapshot = defaultCollectionState;

	const unsubscribe = collectionStateStore.subscribe((value) => {
		snapshot = value;
	});

	unsubscribe();

	return snapshot;
}

export class CollectionService {
	static subscribe = collectionStateStore.subscribe;

	static selectProfile(profileValue: string) {
		const currentState = getCollectionStateSnapshot();

		if (currentState.status === "running") {
			return;
		}

		const selectedProfile = profileValue
			? collectionProfiles.find((profile) => profile.value === profileValue)
			: undefined;

		collectionStateStore.update((state) => ({
			...state,
			selectedProfile: selectedProfile?.value,
			selectedProfileLabel: selectedProfile?.label,
			url: selectedProfile?.url,
			mode: selectedProfile?.mode,
		}));
	}

	static startCollection() {
		const currentState = getCollectionStateSnapshot();

		if (currentState.url === undefined || currentState.mode === undefined) {
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

        // TODO: Implement the actual data collection logic
	}

	static stopCollection() {
		updateElapsedTimeFromStart();
		collectionStateStore.update((state) => ({
			...state,
			status: "idle",
		}));

        // TODO: Implement the actual logic to stop data collection
	}

	static getMetadata() {
		// TODO: Implement the logic to fetch metadata from the target application
	}

	static reset() {
		if (timerHandle !== undefined) {
			clearInterval(timerHandle);
			timerHandle = undefined;
		}
		collectionStartedAt = undefined;
		collectionStateStore.set(defaultCollectionState);
	}
}
