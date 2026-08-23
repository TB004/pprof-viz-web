// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_CHARS = 10;
const RANDOM_CHARS = 16;
/** Largest timestamp representable in 10 base32 characters (48 bits). */
const MAX_TIME = 2 ** 48 - 1;

let lastTime = -1;
const lastRandom = new Uint8Array(RANDOM_CHARS);

function encodeTime(time: number): string {
	let out = "";
	let rest = Math.min(Math.max(time, 0), MAX_TIME);
	for (let i = 0; i < TIME_CHARS; i++) {
		out = ALPHABET[rest % 32] + out;
		rest = Math.floor(rest / 32);
	}
	return out;
}

function nextRandom(sameMillisecond: boolean): void {
	if (!sameMillisecond) {
		crypto.getRandomValues(lastRandom);
		for (let i = 0; i < RANDOM_CHARS; i++) lastRandom[i] &= 0x1f;
		return;
	}
	// Monotonicity inside one millisecond: increment the random component as a
	// big-endian base32 number so ids minted back-to-back still sort correctly.
	for (let i = RANDOM_CHARS - 1; i >= 0; i--) {
		if (lastRandom[i] < 31) {
			lastRandom[i]++;
			return;
		}
		lastRandom[i] = 0;
	}
}

/** A new ULID, monotonically increasing even within the same millisecond. */
export function ulid(now = Date.now()): string {
	const time = Math.max(now, lastTime);
	nextRandom(time === lastTime);
	lastTime = time;

	let random = "";
	for (let i = 0; i < RANDOM_CHARS; i++) random += ALPHABET[lastRandom[i]];
	return encodeTime(time) + random;
}
