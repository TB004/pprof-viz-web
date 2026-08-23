// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { DBStore } from "$lib/storage/idb.js";

const DATABASE_NAME = "pprof-viz";
const DATABASE_VERSION = 1;

export enum Store {
	Projects = "projects",
	Profiles = "profiles",
	Collections = "collections",
}

export const ProfileIndex = { ByProject: "projectId" } as const;

export const ALL_STORES: string[] = Object.values(Store);

/** The shared database, opened on first use. */
export const db = new DBStore(DATABASE_NAME, DATABASE_VERSION, (db, from) => {
	if (from < 1) {
		db.createObjectStore(Store.Projects, { keyPath: "id" });
		const profiles = db.createObjectStore(Store.Profiles, { keyPath: "id" });
		profiles.createIndex(ProfileIndex.ByProject, "projectId", {
			unique: false,
		});
		db.createObjectStore(Store.Collections, { keyPath: "id" });
	}
});
