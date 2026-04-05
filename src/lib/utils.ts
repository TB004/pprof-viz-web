import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Crockford's Base32 alphabet used by the ULID spec
const ULID_ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export type ULID = string & { readonly __brand: "ULID" };

/**
 * Generates a new ULID (Universally Unique Lexicographically Sortable Identifier).
 * Format: 10-char timestamp (48-bit ms since epoch) + 16-char random (80-bit),
 * both encoded in Crockford's Base32. Cryptographically random via crypto.getRandomValues.
 */
export function genUlid(): ULID {
	// Timestamp: 10 base32 chars (50 bits, top 2 always 0 for 48-bit ms epoch)
	let t = Date.now();
	const timeChars = new Array<string>(10);
	for (let i = 9; i >= 0; i--) {
		timeChars[i] = ULID_ENCODING[t & 0x1f];
		t = Math.floor(t / 32);
	}

	// Randomness: 16 base32 chars (80 bits) from 10 crypto-random bytes
	const randBytes = crypto.getRandomValues(new Uint8Array(10));
	const randChars = new Array<string>(16);
	let bits = 0;
	let bitsLeft = 0;
	let byteIdx = 0;
	for (let i = 0; i < 16; i++) {
		if (bitsLeft < 5) {
			bits = (bits << 8) | randBytes[byteIdx++];
			bitsLeft += 8;
		}
		bitsLeft -= 5;
		randChars[i] = ULID_ENCODING[(bits >> bitsLeft) & 0x1f];
	}

	return (timeChars.join("") + randChars.join("")) as ULID;
}

export type WithoutChild<T> = T extends { child?: unknown }
	? Omit<T, "child">
	: T;
export type WithoutChildren<T> = T extends { children?: unknown }
	? Omit<T, "children">
	: T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
	ref?: U | null;
};
