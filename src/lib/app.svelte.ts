// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

// The one instance of each service for the tab. Components import these and
// never construct a service themselves: a second instance would own state
// nothing renders and, for the session, a second worker.

import { ArchiveService } from "#lib/archive/archive.svelte.js";
import { db } from "#lib/db";
import { FileStore } from "#lib/files";
import { ProfileService } from "#lib/profiles/profiles.svelte.js";
import { CollectionService } from "#lib/session/session.svelte.js";
import { SettingsService } from "#lib/settings.svelte.js";
import { TransferService } from "#lib/transfer/transfer.svelte.js";
import { ServiceWorkerService } from "#lib/updates.svelte.js";

const files = new FileStore("collections");

export const profileService = new ProfileService(db);
export const collectionService = new CollectionService(profileService);
export const archiveService = new ArchiveService(db, files, collectionService);
export const transferService = new TransferService(
	db,
	files,
	archiveService,
	profileService,
);
export const settingsService = new SettingsService(db, files);
export const serviceWorkerService = new ServiceWorkerService();
