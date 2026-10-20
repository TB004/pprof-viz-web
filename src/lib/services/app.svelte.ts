// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { Archive } from "#lib/archive";
import { DB } from "#lib/data";
import { FileStore, JsonStore } from "#lib/storage";
import type { AppSettings } from "#lib/types";
import { ArchiveService } from "./archive_service.svelte.js";
import { CollectionService } from "./collection_service.svelte.js";
import { ErrorService } from "./error_service.svelte.js";
import { ProfileService } from "./profile_service.svelte.js";
import { ServiceWorkerService } from "./service_worker_service.svelte.js";
import { defaultSettings, SettingsService } from "./settings_service.svelte.js";
import { TransferService } from "./transfer_service.svelte.js";

export const COLLECTIONS_DIRECTORY = "collections";
export const SETTINGS_KEY = "pprof-viz-settings";

const files = new FileStore(COLLECTIONS_DIRECTORY);
// One codec for the tab: the zstd module is per-document, so a second Archive
// would re-initialise the wasm instance underneath the first.
const archive = new Archive();
const settingsStore = new JsonStore<AppSettings>(SETTINGS_KEY, defaultSettings);

export const errorService = new ErrorService();
export const profileService = new ProfileService(DB.db, errorService);
export const collectionService = new CollectionService(
	profileService,
	errorService,
);
export const archiveService = new ArchiveService(
	DB.db,
	files,
	archive,
	collectionService,
	errorService,
);
export const transferService = new TransferService(
	DB.db,
	files,
	archive,
	archiveService,
	profileService,
	errorService,
);
export const settingsService = new SettingsService(settingsStore, DB.db, files);
export const serviceWorkerService = new ServiceWorkerService();
