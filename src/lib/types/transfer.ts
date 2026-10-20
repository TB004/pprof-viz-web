// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import type { CollectionRow, ProfileRow, ProjectRow } from "./domain.js";

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

/** What an export should gather. Empty selections contribute nothing. */
export interface ExportScope {
	projectIds?: string[];
	profileIds?: string[];
	collectionIds?: string[];
	/** Take every project, profile and collection, ignoring the id lists. */
	all?: boolean;
}

export interface ExportOptions {
	/** Pack the `.ppvz` payloads of the in-scope collections. */
	includeArchives: boolean;
	credentials: BundleCredentials;
	/** Required when `credentials` is `encrypted`. */
	passphrase?: string;
}

/** What to do with records a bundle brings that already exist locally. */
export const ImportMode = {
	Skip: "skip",
	Copy: "copy",
	Replace: "replace",
} as const;
export type ImportMode = (typeof ImportMode)[keyof typeof ImportMode];

/** The shape of an import file, decided by sniffing its first bytes. */
export const TransferKind = {
	Archive: "archive",
	ArchiveZip: "archive-zip",
	Bundle: "bundle",
} as const;
export type TransferKind = (typeof TransferKind)[keyof typeof TransferKind];

/** One archive payload staged for import, not yet written anywhere. */
export interface StagedPayload {
	/** The id carried by the bundle, or a freshly minted one for a bare file. */
	id: string;
	row: CollectionRow;
	bytes: Uint8Array;
}

/** How many of a bundle's records are already present locally. */
export interface CollisionCounts {
	projects: number;
	profiles: number;
	collections: number;
}

/** A parsed, validated import awaiting the user's collision choice. */
export interface StagedImport {
	kind: TransferKind;
	sources: string[];
	projects: ProjectRow[];
	profiles: BundleProfile[];
	payloads: StagedPayload[];
	/** Collections carried as metadata only, with no payload in the file. */
	orphanCollections: CollectionRow[];
	credentials: BundleCredentials;
	kdf?: BundleKdf;
	collisions: CollisionCounts;
	totalBytes: number;
}

/** The records one import commits, already resolved against the chosen mode. */
export interface ImportPlan {
	projects: ProjectRow[];
	profiles: ProfileRow[];
	collections: CollectionRow[];
	/** Files to delete once the transaction commits, for replaced payloads. */
	supersededFiles: string[];
}
