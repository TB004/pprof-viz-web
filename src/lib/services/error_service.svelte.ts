// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { listen } from "@tauri-apps/api/event";
import { browser } from "$app/environment";
import { MAX_ERRORS } from "$lib/generated/error";
import { ErrorIpc } from "$lib/ipc";
import type { AppError } from "$lib/types";

export type { AppError };

const EVENT_NEW_ERROR = "error://new";

const errors = $state<AppError[]>([]);

export const errorState: readonly AppError[] = errors;

async function refresh() {
	try {
		errors.splice(0, errors.length, ...(await ErrorIpc.getErrors()));
	} catch {
		// ignore — the list keeps its last known state
	}
}

function prepend(entry: AppError) {
	if (errors.some((e) => e.id === entry.id)) return;
	errors.unshift(entry);
	if (errors.length > MAX_ERRORS) errors.length = MAX_ERRORS;
}

let unlistenNewError: (() => void) | null = null;

if (browser) {
	refresh().then(async () => {
		// Rust emits this event whenever a new error is pushed to ErrorLog, with
		// the pushed entry as its payload.
		unlistenNewError = await listen<AppError>(EVENT_NEW_ERROR, (event) => {
			prepend(event.payload);
		});
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
	await ErrorIpc.registerError(message);
}

export async function removeError(errorId: string) {
	try {
		await ErrorIpc.removeError(errorId);
	} finally {
		await refresh();
	}
}

export async function clearErrors() {
	try {
		await ErrorIpc.clearErrors();
	} finally {
		await refresh();
	}
}
