// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { ulid } from "$lib/core/ids.js";
import { requireText, trimToNull } from "$lib/core/text.js";
import type { DBStore } from "$lib/storage/idb.js";
import type { ProfileInput, ProfileRow } from "$lib/types";
import { Store } from "./database.js";

/** Trim the user-supplied fields and reject anything the RPC layer can't use. */
function normalize(input: ProfileInput): ProfileInput {
	const url = requireText(input.url, "profile url");
	try {
		new URL(url);
	} catch {
		throw new Error(`invalid url: ${url}`);
	}
	return {
		name: requireText(input.name, "profile name"),
		url,
		mode: input.mode,
		token: trimToNull(input.token),
		intervalSeconds: input.intervalSeconds ?? null,
		numberOfCycles: input.numberOfCycles ?? null,
	};
}

export class Profiles {
	readonly #db: DBStore;

	constructor(db: DBStore) {
		this.#db = db;
	}

	list(): Promise<ProfileRow[]> {
		return this.#db.getAll<ProfileRow>(Store.Profiles);
	}

	get(id: string): Promise<ProfileRow | undefined> {
		return this.#db.get<ProfileRow>(Store.Profiles, id);
	}

	async create(projectId: string, input: ProfileInput): Promise<ProfileRow> {
		const now = Date.now();
		const row: ProfileRow = {
			...normalize(input),
			id: ulid(now),
			projectId,
			createdAt: now,
			updatedAt: now,
		};
		await this.#db.add(Store.Profiles, row);
		return row;
	}

	update(id: string, input: ProfileInput): Promise<void> {
		const normalized = normalize(input);
		return this.#db.update<ProfileRow>(Store.Profiles, id, (row) => ({
			...row,
			...normalized,
			updatedAt: Date.now(),
		}));
	}

	remove(id: string): Promise<void> {
		return this.#db.delete(Store.Profiles, id);
	}
}
