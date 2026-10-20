// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { create } from "@bufbuild/protobuf";
import { type Archive, CollectionMetaSchema } from "#lib/archive";
import {
	ARCHIVE_EXTENSION,
	BUNDLE_EXTENSION,
	BUNDLE_VERSION,
	type Detected,
	deriveKey,
	detect,
	isSealed,
	newKdf,
	openToken,
	pack,
	sealToken,
	unpack,
	unpackArchives,
	zip,
} from "#lib/bundle";
import { Collections, Imports, Profiles, Projects } from "#lib/data";
import {
	type DBStore,
	type FileStore,
	type PickedFile,
	pickFiles,
	saveFile,
} from "#lib/storage";
import {
	BundleCredentials,
	type BundleKdf,
	type BundleManifest,
	type BundleProfile,
	type CollectionRow,
	type CollisionCounts,
	type ExportOptions,
	type ExportScope,
	ImportMode,
	type ImportPlan,
	type ProfileRow,
	type ProjectRow,
	type StagedImport,
	type StagedPayload,
	TransferKind,
} from "#lib/types";
import { TextUtils, ulid } from "#lib/utils";
import type { ArchiveService } from "./archive_service.svelte.js";
import type { ErrorService } from "./error_service.svelte.js";
import type { ProfileService } from "./profile_service.svelte.js";

const APP_ID = "pprof-viz-web";
const ARCHIVE_MIME = "application/octet-stream";
const ZIP_MIME = "application/zip";

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
 * Moving data in and out of the browser. Archives travel as `.ppvz` — the same
 * bytes the desktop app reads — while the metadata graph around them travels in
 * a `.ppvzb` bundle, which is a zip of a manifest and those same payloads.
 */
export class TransferService {
	readonly #state: TransferState;
	readonly #collections: Collections;
	readonly #projects: Projects;
	readonly #profiles: Profiles;
	readonly #imports: Imports;
	readonly #archive: Archive;
	readonly #fs: FileStore;
	readonly #archives: ArchiveService;
	readonly #catalog: ProfileService;
	readonly #errors: ErrorService;

	constructor(
		db: DBStore,
		fs: FileStore,
		archive: Archive,
		archives: ArchiveService,
		catalog: ProfileService,
		errors: ErrorService,
	) {
		this.#collections = new Collections(db);
		this.#projects = new Projects(db);
		this.#profiles = new Profiles(db);
		this.#imports = new Imports(db);
		this.#archive = archive;
		this.#fs = fs;
		this.#archives = archives;
		this.#catalog = catalog;
		this.#errors = errors;
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
	exportArchives(ids: string[]): Promise<boolean> {
		return this.#guarded("export archives", async () => {
			if (ids.length === 0) throw new Error("nothing selected to export");

			const payloads = await this.#readPayloads(ids);
			if (payloads.length === 1) {
				const only = payloads[0];
				const name = TextUtils.safeFilename(only.row.name, only.row.id);
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
				`pprof-viz-archives-${TextUtils.filenameStamp()}.zip`,
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
	): Promise<boolean> {
		return this.#guarded("export bundle", async () => {
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
				`${TextUtils.safeFilename(suggestedName, "pprof-viz-export")}${BUNDLE_EXTENSION}`,
				pack({ manifest, payloads: packed }),
				ARCHIVE_MIME,
				"pprof-viz bundle",
			);
		});
	}

	// --- import ---

	/** Ask for files, parse them, and hold the result for the import dialog. */
	stageImport(): Promise<boolean> {
		return this.#guarded("read import", async () => {
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
	commitImport(mode: ImportMode, passphrase?: string): Promise<boolean> {
		return this.#guarded("import", async () => {
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
			const row = await this.#collections.get(id);
			if (!row) throw new Error(`collection "${id}" not found`);

			// The row is authoritative — a rename never rewrote the file — so the
			// exported copy has to carry the current name, not the captured one.
			const bytes = await this.#archive.rewriteMeta(
				await this.#fs.read(row.filename),
				metaOf(row),
			);
			payloads.push({ id, row, bytes });
			done += 1;
		}
		this.#phase("Reading archives", { done, total: ids.length });
		return payloads;
	}

	async #gather(scope: ExportScope): Promise<Gathered> {
		if (scope.all) return this.#imports.exportAll();

		const [allProjects, allProfiles, allCollections] = await Promise.all([
			this.#projects.list(),
			this.#profiles.list(),
			this.#collections.list(),
		]);

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

		const existing = await this.#imports.existingIds();
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
			await this.#archive.decode(bytes);
			staged.push({
				id: row.id,
				row: {
					...row,
					filename: `${row.id}${ARCHIVE_EXTENSION}`,
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
		const payload = await this.#archive.decode(bytes);
		const meta = payload.meta;
		const createdAt = Number(meta.createdAt ?? 0n) || Date.now();
		const id = ulid(createdAt);
		const fallback = name.replace(/\.[^.]+$/, "") || id;

		return {
			id,
			row: {
				id,
				name: meta.name || fallback,
				description: TextUtils.trimToNull(meta.description),
				filename: `${id}${ARCHIVE_EXTENSION}`,
				sizeBytes: bytes.byteLength,
				durationMs: Number(meta.durationMs ?? 0n),
				sampleCount: meta.sampleCount || payload.frames.length,
				profileName: TextUtils.trimToNull(meta.profileName),
				profileUrl: TextUtils.trimToNull(meta.profileUrl),
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
		const existing = await this.#imports.existingIds();
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
			const filename = `${clashes && !copy ? ulid() : id}${ARCHIVE_EXTENSION}`;
			if (clashes && !copy) {
				const current = await this.#collections.get(payload.id);
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
			await this.#imports.commit(plan);
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

	async #guarded(
		label: string,
		operation: () => Promise<void>,
	): Promise<boolean> {
		if (this.#state.busy) return false;
		this.#state.busy = true;
		try {
			await operation();
			return true;
		} catch (error) {
			this.#errors.reportFailure(`Failed to ${label}`, error);
			return false;
		} finally {
			this.#state.busy = false;
			this.#phase("");
		}
	}
}

function emptyCollisions(): CollisionCounts {
	return { projects: 0, profiles: 0, collections: 0 };
}

function metaOf(row: CollectionRow) {
	return create(CollectionMetaSchema, {
		name: row.name,
		description: row.description ?? "",
		profileName: row.profileName ?? "",
		profileUrl: row.profileUrl ?? "",
		mode: row.mode ?? "",
		createdAt: BigInt(row.createdAt),
		durationMs: BigInt(row.durationMs),
		sampleCount: row.sampleCount,
	});
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
	const base = TextUtils.safeFilename(row.name, row.id);
	let candidate = `${base}${extension}`;
	let counter = 2;
	while (candidate in taken) {
		candidate = `${base} (${counter})${extension}`;
		counter += 1;
	}
	return candidate;
}
