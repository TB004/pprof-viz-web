// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

// `manifest.json`, the index of a `.ppvzb` bundle, and its validation. An
// imported file is untrusted, so every field is checked on the way in.

import { ARCHIVE_EXTENSION } from "#lib/archive/codec.js";
import {
	type CollectionRow,
	CollectionType,
	type ProfileRow,
	type ProjectRow,
} from "#lib/types";
import { isUlid } from "#lib/utils";

/** Bump when the manifest layout changes in a way that needs a read migration. */
export const BUNDLE_VERSION = 1;

export const MANIFEST_ENTRY = "manifest.json";
const PAYLOAD_PREFIX = "collections/";
export const BUNDLE_EXTENSION = ".ppvzb";

/** How a bundle carries `ProfileRow.token`, decided at export time. */
export const BundleCredentials = {
	/** The key is absent from every profile; import restores `token: null`. */
	None: "none",
	/** Cleartext, opted into explicitly. */
	Plain: "plain",
	/** AES-GCM ciphertext under a passphrase-derived key. */
	Encrypted: "encrypted",
} as const;
export type BundleCredentials =
	(typeof BundleCredentials)[keyof typeof BundleCredentials];

/** The PBKDF2 parameters a bundle was encrypted with, stored in the manifest. */
export interface BundleKdf {
	salt: string;
	iterations: number;
	hash: "SHA-256";
}

/** One AES-GCM ciphertext, both halves base64. */
export interface SealedToken {
	iv: string;
	ct: string;
}

/**
 * A profile as it travels in a bundle. `token` is a string when credentials are
 * plain, a {@link SealedToken} when encrypted, and absent otherwise.
 */
export type BundleProfile = Omit<ProfileRow, "token"> & {
	token?: string | SealedToken | null;
};

/**
 * `manifest.json`. The bundle's "kind" is only what it carries: a project with
 * its profiles, a lone profile, archives with their metadata, or everything.
 */
export interface BundleManifest {
	bundleVersion: number;
	exportedAt: number;
	app: string;
	credentials: BundleCredentials;
	/** Present only when `credentials` is `encrypted`. */
	kdf?: BundleKdf;
	projects: ProjectRow[];
	profiles: BundleProfile[];
	collections: CollectionRow[];
}

/** True for the `{ iv, ct }` shape, as opposed to a cleartext token. */
export function isSealed(value: unknown): value is SealedToken {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return typeof candidate.iv === "string" && typeof candidate.ct === "string";
}

/** The only entry names `unpack` will accept; also rules out path traversal. */
export function payloadEntryName(id: string): string {
	return `${PAYLOAD_PREFIX}${id}${ARCHIVE_EXTENSION}`;
}

export function payloadEntryId(entry: string): string | null {
	if (!entry.startsWith(PAYLOAD_PREFIX)) return null;
	if (!entry.endsWith(ARCHIVE_EXTENSION)) return null;
	const id = entry.slice(
		PAYLOAD_PREFIX.length,
		entry.length - ARCHIVE_EXTENSION.length,
	);
	return isUlid(id) ? id : null;
}

function fail(what: string): never {
	throw new Error(`invalid bundle manifest: ${what}`);
}

function object(value: unknown, what: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		fail(`${what} is not an object`);
	}
	return value as Record<string, unknown>;
}

function text(row: Record<string, unknown>, key: string, what: string): string {
	const value = row[key];
	if (typeof value !== "string" || !value) fail(`${what} has no "${key}"`);
	return value;
}

function optionalText(
	row: Record<string, unknown>,
	key: string,
): string | null {
	const value = row[key];
	return typeof value === "string" && value ? value : null;
}

function count(
	row: Record<string, unknown>,
	key: string,
	what: string,
): number {
	const value = row[key];
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		fail(`${what} has an invalid "${key}"`);
	}
	return value;
}

function optionalCount(
	row: Record<string, unknown>,
	key: string,
): number | null {
	const value = row[key];
	if (typeof value !== "number" || !Number.isFinite(value)) return null;
	return value;
}

function mode(value: unknown): CollectionType | null {
	return value === CollectionType.Snapshot || value === CollectionType.Stream
		? value
		: null;
}

function readProject(value: unknown, index: number): ProjectRow {
	const what = `project ${index}`;
	const row = object(value, what);
	const id = text(row, "id", what);
	if (!isUlid(id)) fail(`${what} has a malformed id`);
	return {
		id,
		name: text(row, "name", what),
		createdAt: count(row, "createdAt", what),
		updatedAt: count(row, "updatedAt", what),
	};
}

function readProfile(value: unknown, index: number): BundleProfile {
	const what = `profile ${index}`;
	const row = object(value, what);
	const id = text(row, "id", what);
	if (!isUlid(id)) fail(`${what} has a malformed id`);

	const profileMode = mode(row.mode);
	if (!profileMode) fail(`${what} has an unknown mode`);

	const token = row.token;
	if (
		token !== undefined &&
		token !== null &&
		typeof token !== "string" &&
		!isSealed(token)
	) {
		fail(`${what} has a malformed token`);
	}

	return {
		id,
		projectId: text(row, "projectId", what),
		name: text(row, "name", what),
		url: text(row, "url", what),
		mode: profileMode,
		token: token as BundleProfile["token"],
		intervalSeconds: optionalCount(row, "intervalSeconds"),
		numberOfCycles: optionalCount(row, "numberOfCycles"),
		createdAt: count(row, "createdAt", what),
		updatedAt: count(row, "updatedAt", what),
	};
}

function readCollection(value: unknown, index: number): CollectionRow {
	const what = `collection ${index}`;
	const row = object(value, what);
	const id = text(row, "id", what);
	if (!isUlid(id)) fail(`${what} has a malformed id`);

	return {
		id,
		name: text(row, "name", what),
		description: optionalText(row, "description"),
		// The manifest's filename is advisory; the payload is found by id, so a
		// hostile path here can never reach the file store.
		filename: `${id}${ARCHIVE_EXTENSION}`,
		sizeBytes: count(row, "sizeBytes", what),
		durationMs: count(row, "durationMs", what),
		sampleCount: count(row, "sampleCount", what),
		profileName: optionalText(row, "profileName"),
		profileUrl: optionalText(row, "profileUrl"),
		mode: mode(row.mode),
		createdAt: count(row, "createdAt", what),
	};
}

/** Parse and validate `manifest.json`, treating every field as untrusted. */
export function validateManifest(value: unknown): BundleManifest {
	const root = object(value, "manifest");

	const version = root.bundleVersion;
	if (
		typeof version !== "number" ||
		!Number.isInteger(version) ||
		version < 1
	) {
		fail("no bundle version");
	}
	if (version > BUNDLE_VERSION) {
		throw new Error(
			`bundle version ${version} is newer than this build understands`,
		);
	}

	const credentials = root.credentials;
	if (
		credentials !== "none" &&
		credentials !== "plain" &&
		credentials !== "encrypted"
	) {
		fail("unknown credentials mode");
	}

	let kdf: BundleManifest["kdf"];
	if (credentials === "encrypted") {
		const raw = object(root.kdf, "kdf");
		if (raw.hash !== "SHA-256") fail("unsupported key derivation hash");
		kdf = {
			salt: text(raw, "salt", "kdf"),
			iterations: count(raw, "iterations", "kdf"),
			hash: "SHA-256",
		};
	}

	const projects = (Array.isArray(root.projects) ? root.projects : []).map(
		readProject,
	);
	const profiles = (Array.isArray(root.profiles) ? root.profiles : []).map(
		readProfile,
	);
	const collections = (
		Array.isArray(root.collections) ? root.collections : []
	).map(readCollection);

	// A profile without its project would be unreachable in the UI.
	const known = new Set(projects.map((project) => project.id));
	for (const profile of profiles) {
		if (!known.has(profile.projectId)) {
			fail(`profile "${profile.name}" refers to a project the bundle omits`);
		}
	}

	return {
		bundleVersion: version,
		exportedAt: optionalCount(root, "exportedAt") ?? Date.now(),
		app: optionalText(root, "app") ?? "unknown",
		credentials,
		kdf,
		projects,
		profiles,
		collections,
	};
}
