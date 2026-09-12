// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import type { AppError } from "$lib/types";
import { ulid } from "$lib/utils";

export type { AppError };

/** Newest-first ring buffer; older entries fall off the end. */
export const MAX_ERRORS = 20;

export class ErrorService {
	#state: AppError[];

	constructor() {
		this.#state = $state<AppError[]>([]);
	}

	getErrorLog(): readonly AppError[] {
		return this.#state;
	}

	/** Record a problem for the status bar's error view. */
	registerError(message: string): AppError {
		const entry: AppError = { id: ulid(), message, timestamp: Date.now() };
		this.#state.unshift(entry);
		if (this.#state.length > MAX_ERRORS) this.#state.length = MAX_ERRORS;
		return entry;
	}

	/** Record a caught value, unwrapping `Error` and falling back to `context`. */
	reportFailure(context: string, error: unknown): void {
		this.registerError(
			error instanceof Error ? error.message : `${context}: ${error}`,
		);
	}

	removeError(errorId: string): void {
		const index = this.#state.findIndex((entry) => entry.id === errorId);
		if (index >= 0) this.#state.splice(index, 1);
	}

	clearErrors(): void {
		this.#state.length = 0;
	}
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
