// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

// Figures derived from the merged frames. The runtime reports most counters as
// totals since process start; these turn them into what happened per sample.

import type { Frame } from "#lib/types";
import { deltas } from "#lib/utils";

/** CPU-seconds spent in each class between two samples. */
export interface CpuSample {
	user: number;
	gc: number;
	gcAssist: number;
	gcDedicated: number;
	gcPause: number;
	gcIdle: number;
	scavenge: number;
	idle: number;
	total: number;
	/** Share of the available CPU time that was not idle, in percent. */
	utilisation: number;
}

export function cpuSamples(frames: Frame[]): CpuSample[] {
	const per = (pick: (f: Frame) => number | undefined) =>
		deltas(frames.map((f) => pick(f) ?? 0));
	const user = per((f) => f.cpu?.userSeconds);
	const gc = per((f) => f.cpu?.gcTotalSeconds);
	const gcAssist = per((f) => f.cpu?.gcAssistSeconds);
	const gcDedicated = per((f) => f.cpu?.gcDedicatedSeconds);
	const gcPause = per((f) => f.cpu?.gcPauseSeconds);
	const gcIdle = per((f) => f.cpu?.gcIdleSeconds);
	const scavenge = per((f) => f.cpu?.scavengeTotalSeconds);
	const idle = per((f) => f.cpu?.idleSeconds);
	const total = per((f) => f.cpu?.totalSeconds);
	return frames.map((_, i) => ({
		user: user[i],
		gc: gc[i],
		gcAssist: gcAssist[i],
		gcDedicated: gcDedicated[i],
		gcPause: gcPause[i],
		gcIdle: gcIdle[i],
		scavenge: scavenge[i],
		idle: idle[i],
		total: total[i],
		utilisation:
			total[i] > 0 ? Math.min(100, ((total[i] - idle[i]) / total[i]) * 100) : 0,
	}));
}

/** CPU utilisation of the newest sample, or undefined without two samples. */
export function latestUtilisation(frames: Frame[]): number | undefined {
	if (frames.length < 2) return undefined;
	return cpuSamples(frames.slice(-2)).at(-1)?.utilisation;
}
