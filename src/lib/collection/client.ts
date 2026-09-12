// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import type { SessionProfile, WorkerEvent } from "./protocol.js";

/**
 * Main-thread handle on the collection worker. The worker is spawned on the
 * first `start` and kept for the tab's lifetime.
 */
export class CollectionWorkerHandle {
	readonly #onEvent: (event: WorkerEvent) => void;
	#worker: Worker | undefined;

	constructor(onEvent: (event: WorkerEvent) => void) {
		this.#onEvent = onEvent;
	}

	#ensure(): Worker {
		if (this.#worker) return this.#worker;
		const worker = new Worker(new URL("./worker.ts", import.meta.url), {
			type: "module",
			name: "pprof-viz-collection",
		});
		worker.addEventListener("message", (event: MessageEvent<WorkerEvent>) =>
			this.#onEvent(event.data),
		);
		worker.addEventListener("error", (event) => {
			this.#onEvent({
				type: "failed",
				sessionId: "",
				message: `collection worker crashed: ${event.message}`,
			});
		});
		this.#worker = worker;
		return worker;
	}

	start(sessionId: string, profile: SessionProfile): void {
		this.#ensure().postMessage({ type: "start", sessionId, profile });
	}

	stop(sessionId: string): void {
		// No worker means no session to stop.
		if (this.#worker) this.#ensure().postMessage({ type: "stop", sessionId });
	}

	dispose(): void {
		this.#worker?.terminate();
		this.#worker = undefined;
	}
}
