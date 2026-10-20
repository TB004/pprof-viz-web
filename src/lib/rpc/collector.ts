// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { createClient } from "@connectrpc/connect";
import { CollectorService } from "#lib/proto/gen/collector_pb.js";
import type { Frame, MetadataResponse } from "#lib/types";
import { createTransport, type TransportOptions } from "./connect.js";

const PING_TIMEOUT_MS = 10_000;

export interface CallOptions {
	signal?: AbortSignal;
	timeoutMs?: number;
}

export class CollectorClient {
	readonly #client: ReturnType<typeof createClient<typeof CollectorService>>;

	constructor(options: TransportOptions) {
		this.#client = createClient(CollectorService, createTransport(options));
	}

	/** Reachability and auth check; resolves only if the agent answers. */
	async ping(options: CallOptions = {}): Promise<void> {
		await this.#client.ping({}, { timeoutMs: PING_TIMEOUT_MS, ...options });
	}

	/** Histogram bucket boundaries, constant for the lifetime of a run. */
	getMetadata(options: CallOptions = {}): Promise<MetadataResponse> {
		return this.#client.getMetadata({}, options);
	}

	/** A single point-in-time sample. */
	snapshotAll(options: CallOptions = {}): Promise<Frame> {
		return this.#client.snapshotAll({}, options);
	}

	/** Samples every `intervalSeconds` until `numberOfCycles` (0 = forever). */
	streamAll(
		config: { intervalSeconds: number; numberOfCycles: number },
		options: CallOptions = {},
	): AsyncIterable<Frame> {
		return this.#client.streamAll(config, options);
	}
}

export { describeError, isCancellation } from "./connect.js";
