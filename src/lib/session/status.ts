// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { CollectionStatus, CollectionType, type ProfileRow } from "#lib/types";
import type { CollectionState } from "./session.svelte.js";

export type SessionTone = "live" | "connecting" | "failed" | "stopped" | "idle";

/** How the session reads in a word, and the colour of its status dot. */
export function sessionStatus(state: CollectionState): {
	label: string;
	tone: SessionTone;
} {
	if (state.status === CollectionStatus.Running) {
		if (state.collectedSamples === 0) {
			return { label: "Connecting…", tone: "connecting" };
		}
		return {
			label: state.mode === CollectionType.Snapshot ? "Capturing" : "Streaming",
			tone: "live",
		};
	}
	if (state.error) return { label: "Failed", tone: "failed" };
	if (state.loaded) return { label: "From archive", tone: "stopped" };
	if (state.collectedSamples > 0) return { label: "Stopped", tone: "stopped" };
	return { label: "Idle", tone: "idle" };
}

/** "Stream · every 1s · until stopped", or "Snapshot". */
export function modeLabel(
	profile:
		| Pick<ProfileRow, "mode" | "intervalSeconds" | "numberOfCycles">
		| undefined,
	fallback?: CollectionType,
): string {
	const mode = profile?.mode ?? fallback;
	if (mode === CollectionType.Snapshot) return "Snapshot";
	if (mode !== CollectionType.Stream) return "—";
	if (!profile) return "Stream";
	const cycles = profile.numberOfCycles
		? `${profile.numberOfCycles} cycles`
		: "until stopped";
	return `Stream · every ${profile.intervalSeconds ?? 1}s · ${cycles}`;
}
