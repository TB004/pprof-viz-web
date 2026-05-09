import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { type Readable, writable } from "svelte/store";
import { browser } from "$app/environment";

export interface AppError {
	id: string;
	message: string;
	timestamp: number;
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
		errorStore.set(await invoke<AppError[]>("get_errors"));
	} catch {
		// ignore — store keeps its last known state
	}
}

if (browser) {
	void refresh();
	// Rust emits this event whenever a new error is pushed to ErrorLog.
	void listen(EVENT_NEW_ERROR, () => void refresh());
}

export function formatErrorTimestamp(timestamp: number): string {
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
	await invoke("register_error", { message });
}

export async function removeError(errorId: string) {
	try {
		await invoke("remove_error", { id: errorId });
	} finally {
		// remove_error emits no event, so re-fetch explicitly.
		await refresh();
	}
}

export async function clearErrors() {
	try {
		await invoke("clear_errors");
	} finally {
		await refresh();
	}
}
