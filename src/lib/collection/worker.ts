// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import {
	CollectorClient,
	describeError,
	isCancellation,
} from "#lib/rpc/collector.js";
import type { Frame } from "#lib/types";
import { CollectionType } from "#lib/types";
import { FrameUtils } from "#lib/utils";
import type { SessionProfile, WorkerCommand, WorkerEvent } from "./protocol.js";

interface WorkerScope {
	postMessage(event: WorkerEvent): void;
	addEventListener(
		type: "message",
		listener: (event: MessageEvent<WorkerCommand>) => void,
	): void;
}

/**
 * Worker-side session runner. Owns the one in-flight session and translates
 * `WorkerCommand`s from the main thread into `WorkerEvent`s.
 */
export class CollectionWorker {
	readonly #scope: WorkerScope;
	#activeSessionId: string | null = null;
	#abort: AbortController | null = null;

	constructor(scope: WorkerScope) {
		this.#scope = scope;
	}

	/** Begins dispatching commands arriving on the worker scope. */
	listen(): void {
		this.#scope.addEventListener("message", ({ data }) => {
			switch (data.type) {
				case "start":
					this.#stop();
					this.#activeSessionId = data.sessionId;
					void this.#run(data.sessionId, data.profile);
					break;
				case "stop":
					if (data.sessionId === this.#activeSessionId) this.#stop();
					break;
			}
		});
	}

	#emit(event: WorkerEvent): void {
		// A late event from a replaced session must not reach the UI.
		if (event.sessionId !== this.#activeSessionId) return;
		this.#scope.postMessage(event);
	}

	#fail(
		sessionId: string,
		prefix: string,
		error: unknown,
		baseUrl?: string,
	): void {
		// A stop request surfaces as a cancellation — expected, not a failure.
		if (isCancellation(error)) return;
		this.#emit({
			type: "failed",
			sessionId,
			message: `${prefix}: ${describeError(error, baseUrl)}`,
		});
	}

	async #collect(
		sessionId: string,
		client: CollectorClient,
		profile: SessionProfile,
		signal: AbortSignal,
	): Promise<void> {
		let previous: Frame | null = null;

		const push = (frame: Frame) => {
			// Always merge, even the first frame, so its histograms are normalised
			// to dense `counts` regardless of collection mode.
			previous = FrameUtils.mergeFrame(previous, frame);
			this.#emit({
				type: "frame",
				sessionId,
				frame: previous,
				timestamp: Date.now(),
			});
		};

		if (profile.mode === CollectionType.Snapshot) {
			push(await client.snapshotAll({ signal }));
			return;
		}

		const stream = client.streamAll(
			{
				intervalSeconds: profile.intervalSeconds ?? 1,
				numberOfCycles: profile.numberOfCycles ?? 0,
			},
			{ signal },
		);
		for await (const frame of stream) {
			if (signal.aborted) return;
			push(frame);
		}
	}

	async #run(sessionId: string, profile: SessionProfile): Promise<void> {
		const controller = new AbortController();
		this.#abort = controller;

		try {
			const client = new CollectorClient({
				baseUrl: profile.url,
				token: profile.token,
			});

			try {
				const metadata = await client.getMetadata({
					signal: controller.signal,
				});
				this.#emit({ type: "metadata", sessionId, metadata });
			} catch (error) {
				// Without bucket boundaries the histograms are unreadable, so a
				// metadata failure ends the session rather than degrading it.
				this.#fail(sessionId, "failed to fetch metadata", error, profile.url);
				return;
			}

			try {
				await this.#collect(sessionId, client, profile, controller.signal);
			} catch (error) {
				this.#fail(
					sessionId,
					profile.mode === CollectionType.Snapshot
						? "snapshot failed"
						: "stream failed",
					error,
					profile.url,
				);
			}
		} catch (error) {
			this.#fail(sessionId, "failed to connect", error, profile.url);
		} finally {
			this.#emit({ type: "ended", sessionId, endedAt: Date.now() });
			if (this.#abort === controller) this.#abort = null;
		}
	}

	#stop(): void {
		this.#abort?.abort();
		this.#abort = null;
	}
}

new CollectionWorker(self as unknown as WorkerScope).listen();
