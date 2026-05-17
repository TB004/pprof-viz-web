import { listen } from "@tauri-apps/api/event";
import { type Readable, writable } from "svelte/store";
import { browser } from "$app/environment";
import { commands } from "$lib/bindings";
import { run } from "./invoke.js";

export interface AppError {
	id: string;
	message: string;
	timestamp: number | null;
}

const EVENT_NEW_ERROR = "error://new";

// Read-only projection of Rust's ErrorLog. Never mutated locally — always
// re-fetched from Rust so ErrorLog stays the single source of truth.
const errorStore = writable<AppError[]>([]);

export const errorState: Readable<AppError[]> = {
	subscribe: errorStore.subscribe,
};

async function refresh() {
	try {
		errorStore.set(await run(commands.getErrors()));
	} catch {
		// ignore — store keeps its last known state
	}
}

let unlistenNewError: (() => void) | null = null;

if (browser) {
	void refresh();
	// Rust emits this event whenever a new error is pushed to ErrorLog.
	listen(EVENT_NEW_ERROR, () => void refresh()).then((unlisten) => {
		unlistenNewError = unlisten;
	});
}

export function cleanup() {
	unlistenNewError?.();
	unlistenNewError = null;
}

export function formatErrorTimestamp(timestamp: number | null): string {
	if (!timestamp) return "Unknown";
	return new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		month: "long",
		day: "2-digit",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
	}).format(new Date(timestamp));
}

export async function registerError(message: string) {
	// Rust pushes to ErrorLog and emits error://new, which triggers refresh().
	await run(commands.registerError(message));
}

export async function removeError(errorId: string) {
	try {
		await run(commands.removeError(errorId));
	} finally {
		// remove_error emits no event, so re-fetch explicitly.
		await refresh();
	}
}

export async function clearErrors() {
	try {
		await run(commands.clearErrors());
	} finally {
		await refresh();
	}
}
