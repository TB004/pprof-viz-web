// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

export { type Bundle, pack, unpack, unpackArchives } from "./bundle.js";
export {
	deriveKey,
	isSealed,
	KDF_ITERATIONS,
	newKdf,
	openToken,
	sealToken,
} from "./crypto.js";
export {
	ARCHIVE_EXTENSION,
	BUNDLE_EXTENSION,
	BUNDLE_VERSION,
	isUlid,
	MANIFEST_ENTRY,
	PAYLOAD_PREFIX,
	payloadEntryId,
	payloadEntryName,
	validateManifest,
} from "./manifest.js";
export { type Detected, detect } from "./sniff.js";
export {
	checkZipMagic,
	MAX_ENTRIES,
	MAX_UNCOMPRESSED_BYTES,
	unzip,
	zip,
} from "./zip.js";
