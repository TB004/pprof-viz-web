// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import type { ArchiveService } from "#lib/archive/archive.svelte.js";
import {
	ARCHIVE_EXTENSION,
	archiveFilename,
	collectionMeta,
	decodeArchive,
	rewriteMeta,
} from "#lib/archive/codec.js";
import { ALL_STORES, type DBStore, request, Store } from "#lib/db";
import {
	type FileStore,
	type PickedFile,
	pickFiles,
	saveFile,
} from "#lib/files";
import type { ProfileService } from "#lib/profiles/profiles.svelte.js";
import type { CollectionRow, ProfileRow, ProjectRow } from "#lib/types";
import { filenameStamp, safeFilename, trimToNull, ulid } from "#lib/utils";
import {
	type Detected,
	detect,
	pack,
	TransferKind,
	unpack,
	unpackArchives,
	zip,
} from "./bundle.js";
import { deriveKey, newKdf, openToken, sealToken } from "./crypto.js";
import {
	BUNDLE_EXTENSION,
	BUNDLE_VERSION,
	BundleCredentials,
	type BundleKdf,
	type BundleManifest,
	type BundleProfile,
	isSealed,
} from "./manifest.js";

const APP_ID = "pprof-viz-web";
const ARCHIVE_MIME = "application/octet-stream";
const ZIP_MIME = "application/zip";

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

/** One archive payload staged for import, not yet written anywhere. */
interface StagedPayload {
	/** The id carried by the bundle, or a freshly minted one for a bare file. */
	id: string;
	row: CollectionRow;
	bytes: Uint8Array;
}

/** How many of a bundle's records are already present locally. */
interface CollisionCounts {
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
interface ImportPlan {
	projects: ProjectRow[];
	profiles: ProfileRow[];
	collections: CollectionRow[];
	/** Files to delete once the transaction commits, for replaced payloads. */
	supersededFiles: string[];
}

/** Every id already taken, so an import can tell new records from collisions. */
interface ExistingIds {
	projects: Set<string>;
	profiles: Set<string>;
	collections: Set<string>;
}

export interface TransferState {
	busy: boolean;
	/** What the current operation is doing, for the dialogs' pending label. */
	phase: string;
	progress: { done: number; total: number } | null;
	staged: StagedImport | null;
}

/** What an export gathered, before it is turned into a manifest. */
interface Gathered {
	projects: ProjectRow[];
	profiles: ProfileRow[];
	collections: CollectionRow[];
}

/**
 * Moving data in and out of the browser. Archives travel as `.ppvz`, while the
 * metadata graph around them travels in a `.ppvzb` bundle, which is a zip of a manifest and those same payloads.
 * Every action throws, for the dialog or page that started it to report.
 */
export class TransferService {
	readonly #state: TransferState;
	readonly #db: DBStore;
	readonly #fs: FileStore;
	readonly #archives: ArchiveService;
	readonly #catalog: ProfileService;

	constructor(
		db: DBStore,
		fs: FileStore,
		archives: ArchiveService,
		catalog: ProfileService,
	) {
		this.#db = db;
		this.#fs = fs;
		this.#archives = archives;
		this.#catalog = catalog;
		this.#state = $state<TransferState>({
			busy: false,
			phase: "",
			progress: null,
			staged: null,
		});
	}

	/** Reactive; treat as read-only outside this class. */
	getState(): TransferState {
		return this.#state;
	}

	// --- export ---

	/** Write the selected archives: one `.ppvz`, or a zip of them. */
	exportArchives(ids: string[]): Promise<void> {
		return this.#exclusive(async () => {
			if (ids.length === 0) throw new Error("nothing selected to export");

			const payloads = await this.#readPayloads(ids);
			if (payloads.length === 1) {
				const only = payloads[0];
				const name = safeFilename(only.row.name, only.row.id);
				await saveFile(
					`${name}${ARCHIVE_EXTENSION}`,
					only.bytes,
					ARCHIVE_MIME,
					"pprof-viz collection",
				);
				return;
			}

			this.#phase("Packing archives");
			const entries: Record<string, Uint8Array> = {};
			for (const payload of payloads) {
				entries[uniqueName(entries, payload.row, ARCHIVE_EXTENSION)] =
					payload.bytes;
			}
			await saveFile(
				`pprof-viz-archives-${filenameStamp()}.zip`,
				zip(entries, {}),
				ZIP_MIME,
				"pprof-viz collections",
			);
		});
	}

	/** Write a `.ppvzb` bundle covering the given scope. */
	exportBundle(
		scope: ExportScope,
		options: ExportOptions,
		suggestedName: string,
	): Promise<void> {
		return this.#exclusive(async () => {
			const gathered = await this.#gather(scope);
			if (
				gathered.projects.length === 0 &&
				gathered.profiles.length === 0 &&
				gathered.collections.length === 0
			) {
				throw new Error("nothing selected to export");
			}

			const payloads = options.includeArchives
				? await this.#readPayloads(gathered.collections.map((row) => row.id))
				: [];

			// Only ship metadata for payloads that actually made it into the file,
			// so an import never produces a row pointing at nothing.
			const packed = new Map(payloads.map((p) => [p.row.id, p.bytes]));
			const collections = options.includeArchives
				? gathered.collections
						.filter((row) => packed.has(row.id))
						.map((row) => ({
							...row,
							sizeBytes: packed.get(row.id)?.byteLength ?? row.sizeBytes,
						}))
				: [];

			const sealed = await this.#packProfiles(gathered.profiles, options);

			this.#phase("Packing bundle");
			const manifest: BundleManifest = {
				bundleVersion: BUNDLE_VERSION,
				exportedAt: Date.now(),
				app: APP_ID,
				credentials: options.credentials,
				kdf: sealed.kdf,
				projects: gathered.projects,
				profiles: sealed.profiles,
				collections,
			};

			await saveFile(
				`${safeFilename(suggestedName, "pprof-viz-export")}${BUNDLE_EXTENSION}`,
				pack({ manifest, payloads: packed }),
				ARCHIVE_MIME,
				"pprof-viz bundle",
			);
		});
	}

	// --- import ---

	/** Ask for files, parse them, and hold the result for the import dialog. */
	stageImport(): Promise<void> {
		return this.#exclusive(async () => {
			const files = await pickFiles({
				extensions: [ARCHIVE_EXTENSION, BUNDLE_EXTENSION, ".zip"],
				description: "pprof-viz collections and bundles",
				multiple: true,
			});
			if (files.length === 0) return;

			this.#phase("Reading files");
			this.#state.staged = await this.#stage(files);
		});
	}

	clearStaged(): void {
		this.#state.staged = null;
	}

	/** Write the staged import, then refresh whatever the UI is showing. */
	commitImport(mode: ImportMode, passphrase?: string): Promise<void> {
		return this.#exclusive(async () => {
			const staged = this.#state.staged;
			if (!staged) throw new Error("nothing staged to import");

			const plan = await this.#plan(staged, mode, passphrase);
			await this.#commit(plan.plan, plan.files);
			this.#state.staged = null;

			this.#phase("Refreshing");
			await Promise.all([this.#archives.refresh(), this.#catalog.refresh()]);
		});
	}

	// --- internals ---

	#phase(phase: string, progress: TransferState["progress"] = null): void {
		this.#state.phase = phase;
		this.#state.progress = progress;
	}

	/** Read payloads out of OPFS, refreshing each file's embedded metadata. */
	async #readPayloads(ids: string[]): Promise<StagedPayload[]> {
		const payloads: StagedPayload[] = [];
		let done = 0;
		for (const id of ids) {
			this.#phase("Reading archives", { done, total: ids.length });
			const row = await this.#archives.get(id);
			if (!row) throw new Error(`collection "${id}" not found`);

			// The row is authoritative — a rename never rewrote the file — so the
			// exported copy has to carry the current name, not the captured one.
			const bytes = await rewriteMeta(
				await this.#fs.read(row.filename),
				collectionMeta(row),
			);
			payloads.push({ id, row, bytes });
			done += 1;
		}
		this.#phase("Reading archives", { done, total: ids.length });
		return payloads;
	}

	async #gather(scope: ExportScope): Promise<Gathered> {
		const all = await this.#db.transaction(
			ALL_STORES,
			"readonly",
			async (tx) => ({
				projects: await request<ProjectRow[]>(
					tx.objectStore(Store.Projects).getAll(),
				),
				profiles: await request<ProfileRow[]>(
					tx.objectStore(Store.Profiles).getAll(),
				),
				collections: await request<CollectionRow[]>(
					tx.objectStore(Store.Collections).getAll(),
				),
			}),
		);
		if (scope.all) return all;

		const {
			projects: allProjects,
			profiles: allProfiles,
			collections: allCollections,
		} = all;

		const projectIds = new Set(scope.projectIds ?? []);
		const profileIds = new Set(scope.profileIds ?? []);

		const profiles = allProfiles.filter(
			(row) => profileIds.has(row.id) || projectIds.has(row.projectId),
		);
		// A profile is unusable without its project, so pull those in.
		for (const profile of profiles) projectIds.add(profile.projectId);
		const projects = allProjects.filter((row) => projectIds.has(row.id));

		const explicit = new Set(scope.collectionIds ?? []);
		const collections = allCollections.filter(
			(row) => explicit.has(row.id) || capturedBy(row, profiles),
		);

		return { projects, profiles, collections };
	}

	async #packProfiles(
		profiles: ProfileRow[],
		options: ExportOptions,
	): Promise<{ profiles: BundleProfile[]; kdf?: BundleKdf }> {
		if (options.credentials === BundleCredentials.None) {
			return { profiles: profiles.map(({ token: _token, ...rest }) => rest) };
		}
		if (options.credentials === BundleCredentials.Plain) {
			return { profiles: profiles.map((row) => ({ ...row })) };
		}

		const passphrase = options.passphrase ?? "";
		if (!passphrase) {
			throw new Error("a passphrase is required to encrypt credentials");
		}

		this.#phase("Encrypting credentials");
		// One salt per export, so every token in the file shares a derived key.
		const kdf = newKdf();
		const key = await deriveKey(passphrase, kdf);
		return {
			kdf,
			profiles: await Promise.all(
				profiles.map(async (row) => ({
					...row,
					token: row.token ? await sealToken(key, row.token) : null,
				})),
			),
		};
	}

	async #stage(files: PickedFile[]): Promise<StagedImport> {
		const read = files.map((file) => ({ file, detected: detect(file.bytes) }));
		const bundles = read.filter(
			(entry) => entry.detected.kind === TransferKind.Bundle,
		);
		if (bundles.length > 0 && read.length > 1) {
			throw new Error("import a bundle on its own, not alongside other files");
		}

		const staged =
			bundles.length === 1
				? await this.#stageBundle(files[0])
				: await this.#stageArchives(read);

		const existing = await this.#existingIds();
		staged.collisions = {
			projects: staged.projects.filter((row) => existing.projects.has(row.id))
				.length,
			profiles: staged.profiles.filter((row) => existing.profiles.has(row.id))
				.length,
			collections: staged.payloads.filter((p) => existing.collections.has(p.id))
				.length,
		};
		staged.totalBytes = staged.payloads.reduce(
			(sum, payload) => sum + payload.bytes.byteLength,
			0,
		);
		return staged;
	}

	async #stageBundle(file: PickedFile): Promise<StagedImport> {
		const { manifest, payloads } = unpack(file.bytes);

		const staged: StagedPayload[] = [];
		const orphans: CollectionRow[] = [];
		for (const row of manifest.collections) {
			const bytes = payloads.get(row.id);
			// Metadata with no payload would point at a file that does not exist.
			if (!bytes) {
				orphans.push(row);
				continue;
			}
			await decodeArchive(bytes);
			staged.push({
				id: row.id,
				row: {
					...row,
					filename: archiveFilename(row.id),
					sizeBytes: bytes.byteLength,
				},
				bytes,
			});
		}

		return {
			kind: TransferKind.Bundle,
			sources: [file.name],
			projects: manifest.projects,
			profiles: manifest.profiles,
			payloads: staged,
			orphanCollections: orphans,
			credentials: manifest.credentials,
			kdf: manifest.kdf,
			collisions: emptyCollisions(),
			totalBytes: 0,
		};
	}

	async #stageArchives(
		read: { file: PickedFile; detected: Detected }[],
	): Promise<StagedImport> {
		const payloads: StagedPayload[] = [];
		let kind: TransferKind = TransferKind.Archive;

		for (const { file, detected } of read) {
			if (detected.kind === TransferKind.ArchiveZip) {
				kind = TransferKind.ArchiveZip;
				const archives = unpackArchives(file.bytes, detected.entries);
				for (const [name, bytes] of archives) {
					payloads.push(await this.#stageArchive(name, bytes));
				}
			} else {
				payloads.push(await this.#stageArchive(file.name, file.bytes));
			}
		}

		if (payloads.length === 0) {
			throw new Error("no collections in the selection");
		}
		return {
			kind,
			sources: read.map((entry) => entry.file.name),
			projects: [],
			profiles: [],
			payloads,
			orphanCollections: [],
			credentials: BundleCredentials.None,
			collisions: emptyCollisions(),
			totalBytes: 0,
		};
	}

	/** A bare `.ppvz` carries no id, so it always arrives as a new collection. */
	async #stageArchive(name: string, bytes: Uint8Array): Promise<StagedPayload> {
		const payload = await decodeArchive(bytes);
		const meta = payload.meta;
		const createdAt = Number(meta.createdAt ?? 0n) || Date.now();
		const id = ulid(createdAt);
		const fallback = name.replace(/\.[^.]+$/, "") || id;

		return {
			id,
			row: {
				id,
				name: meta.name || fallback,
				description: trimToNull(meta.description),
				filename: archiveFilename(id),
				sizeBytes: bytes.byteLength,
				durationMs: Number(meta.durationMs ?? 0n),
				sampleCount: meta.sampleCount || payload.frames.length,
				profileName: trimToNull(meta.profileName),
				profileUrl: trimToNull(meta.profileUrl),
				mode: modeOf(meta.mode),
				createdAt,
			},
			bytes,
		};
	}

	/** Resolve a staged import against the chosen collision mode. */
	async #plan(
		staged: StagedImport,
		mode: ImportMode,
		passphrase?: string,
	): Promise<{
		plan: ImportPlan;
		files: { name: string; bytes: Uint8Array }[];
	}> {
		const existing = await this.#existingIds();
		const tokens = await this.#unsealTokens(staged, passphrase);

		// A copy keeps nothing of the original identity, so every id is reminted
		// and references are rewritten through these maps.
		const copy = mode === ImportMode.Copy;
		const projectIds = new Map<string, string>();
		for (const row of staged.projects) {
			projectIds.set(row.id, copy ? ulid(row.createdAt) : row.id);
		}

		const skip = mode === ImportMode.Skip;
		const projects = staged.projects
			.filter((row) => !(skip && existing.projects.has(row.id)))
			.map((row) => ({ ...row, id: projectIds.get(row.id) ?? row.id }));

		const profiles: ProfileRow[] = staged.profiles
			.filter((row) => !(skip && existing.profiles.has(row.id)))
			.map((row) => ({
				...row,
				id: copy ? ulid(row.createdAt) : row.id,
				projectId: projectIds.get(row.projectId) ?? row.projectId,
				token: tokens.get(row.id) ?? null,
			}));

		const collections: CollectionRow[] = [];
		const files: { name: string; bytes: Uint8Array }[] = [];
		const superseded: string[] = [];

		for (const payload of staged.payloads) {
			const clashes = existing.collections.has(payload.id);
			if (skip && clashes) continue;

			const id = copy ? ulid(payload.row.createdAt) : payload.id;
			// Replacing keeps the id but must not overwrite the old payload before
			// the transaction commits, so the row points at a brand new file.
			const filename = archiveFilename(clashes && !copy ? ulid() : id);
			if (clashes && !copy) {
				const current = await this.#archives.get(payload.id);
				if (current) superseded.push(current.filename);
			}

			collections.push({ ...payload.row, id, filename });
			files.push({ name: filename, bytes: payload.bytes });
		}

		return {
			plan: { projects, profiles, collections, supersededFiles: superseded },
			files,
		};
	}

	async #unsealTokens(
		staged: StagedImport,
		passphrase?: string,
	): Promise<Map<string, string | null>> {
		const tokens = new Map<string, string | null>();
		if (staged.credentials === BundleCredentials.None) return tokens;

		if (staged.credentials === BundleCredentials.Plain) {
			for (const row of staged.profiles) {
				tokens.set(row.id, typeof row.token === "string" ? row.token : null);
			}
			return tokens;
		}

		// No passphrase is a deliberate choice in the dialog: import the profiles
		// and leave the user to re-enter their credentials.
		if (!passphrase || !staged.kdf) return tokens;

		this.#phase("Decrypting credentials");
		const key = await deriveKey(passphrase, staged.kdf);
		for (const row of staged.profiles) {
			tokens.set(
				row.id,
				isSealed(row.token) ? await openToken(key, row.token) : null,
			);
		}
		return tokens;
	}

	/**
	 * Payloads first, then the records in one commit. A failure rolls the files
	 * back, so the store never holds a payload no row points at — and never a row
	 * pointing at a payload that is not there.
	 */
	async #commit(
		plan: ImportPlan,
		files: { name: string; bytes: Uint8Array }[],
	): Promise<void> {
		await this.#checkSpace(files);

		const written: string[] = [];
		try {
			let done = 0;
			for (const file of files) {
				this.#phase("Writing archives", { done, total: files.length });
				await this.#fs.write(file.name, file.bytes);
				written.push(file.name);
				done += 1;
			}
			this.#phase("Saving records");
			// One commit, so a failure part way through leaves the database exactly
			// as it was. `put` rather than `add`: the plan has already resolved
			// collisions, and replacing is one of the outcomes.
			await this.#db.transaction(ALL_STORES, "readwrite", async (tx) => {
				for (const [store, rows] of [
					[Store.Projects, plan.projects],
					[Store.Profiles, plan.profiles],
					[Store.Collections, plan.collections],
				] as const) {
					const objectStore = tx.objectStore(store);
					for (const row of rows) await request(objectStore.put(row));
				}
			});
		} catch (error) {
			await Promise.all(written.map((name) => this.#fs.remove(name)));
			throw error;
		}

		// Only now are the replaced payloads unreachable.
		await Promise.all(
			plan.supersededFiles.map((name) => this.#fs.remove(name)),
		);
	}

	async #checkSpace(files: { bytes: Uint8Array }[]): Promise<void> {
		const needed = files.reduce((sum, file) => sum + file.bytes.byteLength, 0);
		const usage = this.#archives.getState().diskUsage;
		if (!usage || usage.estimated === false) return;
		if (needed > usage.freeBytes) {
			throw new Error(
				"not enough free storage in this browser for the selected archives",
			);
		}
	}

	/** The keys of all three stores, read in one consistent snapshot. */
	#existingIds(): Promise<ExistingIds> {
		return this.#db.transaction(ALL_STORES, "readonly", async (tx) => {
			const keys = async (store: Store) =>
				new Set(
					(
						await request<IDBValidKey[]>(tx.objectStore(store).getAllKeys())
					).map(String),
				);
			return {
				projects: await keys(Store.Projects),
				profiles: await keys(Store.Profiles),
				collections: await keys(Store.Collections),
			};
		});
	}

	/** Run one transfer at a time, with `busy` and `phase` reflecting it. */
	async #exclusive(operation: () => Promise<void>): Promise<void> {
		if (this.#state.busy) {
			throw new Error("another import or export is still running");
		}
		this.#state.busy = true;
		try {
			await operation();
		} finally {
			this.#state.busy = false;
			this.#phase("");
		}
	}
}

function emptyCollisions(): CollisionCounts {
	return { projects: 0, profiles: 0, collections: 0 };
}

function modeOf(value: string): CollectionRow["mode"] {
	return value === "snapshot" || value === "stream" ? value : null;
}

/**
 * Archives denormalise their profile rather than referencing it, so the only
 * link back is the name and URL captured at save time.
 */
function capturedBy(row: CollectionRow, profiles: ProfileRow[]): boolean {
	return profiles.some(
		(profile) =>
			profile.url === row.profileUrl && profile.name === row.profileName,
	);
}

/** Keep zip entry names unique when two collections share a name. */
function uniqueName(
	taken: Record<string, Uint8Array>,
	row: CollectionRow,
	extension: string,
): string {
	const base = safeFilename(row.name, row.id);
	let candidate = `${base}${extension}`;
	let counter = 2;
	while (candidate in taken) {
		candidate = `${base} (${counter})${extension}`;
		counter += 1;
	}
	return candidate;
}
