// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import type { CollectionType, Frame, MetadataResponse } from "#lib/types";

/** Everything the worker needs to run a session, without touching the database. */
export interface SessionProfile {
	url: string;
	token: string | null;
	mode: CollectionType;
	intervalSeconds: number | null;
	numberOfCycles: number | null;
}

export type WorkerCommand =
	| { type: "start"; sessionId: string; profile: SessionProfile }
	| { type: "stop"; sessionId: string };

export type WorkerEvent =
	/** Bucket boundaries, once per session, before any frame. */
	| { type: "metadata"; sessionId: string; metadata: MetadataResponse }
	/** One dense, fully merged sample. */
	| { type: "frame"; sessionId: string; frame: Frame; timestamp: number }
	/** The session hit a problem; `ended` still follows. */
	| { type: "failed"; sessionId: string; message: string }
	/** The session is over — cancelled, cycle limit reached, or failed. */
	| { type: "ended"; sessionId: string; endedAt: number };
