// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import {
	type BundleManifest,
	type BundleProfile,
	type CollectionRow,
	CollectionType,
	type ProjectRow,
} from "#lib/types";
import { isSealed } from "./crypto.js";

/** Bump when the manifest layout changes in a way that needs a read migration. */
export const BUNDLE_VERSION = 1;

export const MANIFEST_ENTRY = "manifest.json";
export const PAYLOAD_PREFIX = "collections/";
export const BUNDLE_EXTENSION = ".ppvzb";
export const ARCHIVE_EXTENSION = ".ppvz";

/** The Crockford base32 alphabet `ulid()` mints ids from. */
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isUlid(value: string): boolean {
	return ULID.test(value);
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
