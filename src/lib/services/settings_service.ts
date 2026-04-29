import { type Readable, writable } from "svelte/store";
import { browser } from "$app/environment";
import { CollectionType } from "./profile_service.js";

export interface ProfileDefaults {
	name: string;
	mode: CollectionType;
	intervalSeconds: number;
	numberOfCycles: number;
	url: string;
}

const DEFAULTS_KEY = "pprof-viz-profile-defaults";

const fallbackDefaults: ProfileDefaults = {
	name: "",
	mode: CollectionType.Stream,
	intervalSeconds: 1,
	numberOfCycles: 0,
	url: "",
};

function loadDefaults(): ProfileDefaults {
	if (!browser) return fallbackDefaults;
	try {
		const stored = localStorage.getItem(DEFAULTS_KEY);
		if (stored) {
			return { ...fallbackDefaults, ...JSON.parse(stored) };
		}
	} catch {
		// ignore
	}
	return fallbackDefaults;
}

const profileDefaultsStore = writable<ProfileDefaults>(loadDefaults());

export const profileDefaults: Readable<ProfileDefaults> = {
	subscribe: profileDefaultsStore.subscribe,
};

export function updateProfileDefaults(patch: Partial<ProfileDefaults>) {
	profileDefaultsStore.update((current) => {
		const updated = { ...current, ...patch };
		if (browser) {
			localStorage.setItem(DEFAULTS_KEY, JSON.stringify(updated));
		}
		return updated;
	});
}

export function getProfileDefaultsSnapshot(): ProfileDefaults {
	let snapshot = fallbackDefaults;
	const unsubscribe = profileDefaultsStore.subscribe((value) => {
		snapshot = value;
	});
	unsubscribe();
	return snapshot;
}
