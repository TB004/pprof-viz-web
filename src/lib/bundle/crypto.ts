// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import type { BundleKdf, SealedToken } from "#lib/types";

/** Deliberately expensive: a bundle is a file that can be attacked offline. */
export const KDF_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function encode(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

// The `ArrayBuffer` parameter matters: WebCrypto will not take a view that
// might sit on a `SharedArrayBuffer`.
function decode(value: string): Uint8Array<ArrayBuffer> {
	const binary = atob(value);
	const bytes = new Uint8Array(new ArrayBuffer(binary.length));
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

function utf8(value: string): Uint8Array<ArrayBuffer> {
	return new TextEncoder().encode(value);
}

/** Fresh PBKDF2 parameters for one export. */
export function newKdf(): BundleKdf {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	return { salt: encode(salt), iterations: KDF_ITERATIONS, hash: "SHA-256" };
}

export async function deriveKey(
	passphrase: string,
	kdf: BundleKdf,
): Promise<CryptoKey> {
	if (kdf.hash !== "SHA-256") {
		throw new Error(`unsupported key derivation hash "${kdf.hash}"`);
	}
	// A bundle names its own iteration count, so a hostile file could ask for an
	// absurd one and hang the tab. Cap it at what we would ever write ourselves.
	if (!Number.isInteger(kdf.iterations) || kdf.iterations < 1) {
		throw new Error("invalid key derivation parameters");
	}
	const iterations = Math.min(kdf.iterations, KDF_ITERATIONS * 2);

	const material = await crypto.subtle.importKey(
		"raw",
		utf8(passphrase),
		"PBKDF2",
		false,
		["deriveKey"],
	);
	return crypto.subtle.deriveKey(
		{ name: "PBKDF2", salt: decode(kdf.salt), iterations, hash: kdf.hash },
		material,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

export async function sealToken(
	key: CryptoKey,
	token: string,
): Promise<SealedToken> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const ct = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		utf8(token),
	);
	return { iv: encode(iv), ct: encode(new Uint8Array(ct)) };
}

/**
 * A wrong passphrase fails the GCM authentication tag, so this doubles as the
 * passphrase check — no separate verifier is stored in the manifest.
 */
export async function openToken(
	key: CryptoKey,
	sealed: SealedToken,
): Promise<string> {
	try {
		const plain = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: decode(sealed.iv) },
			key,
			decode(sealed.ct),
		);
		return new TextDecoder().decode(plain);
	} catch {
		throw new Error(
			"wrong passphrase, or the bundle's credentials are damaged",
		);
	}
}

/** True for the `{ iv, ct }` shape, as opposed to a cleartext token. */
export function isSealed(value: unknown): value is SealedToken {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return typeof candidate.iv === "string" && typeof candidate.ct === "string";
}
