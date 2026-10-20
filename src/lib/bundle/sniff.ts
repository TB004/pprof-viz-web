// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { ZstdCompressor } from "#lib/archive";
import { TransferKind } from "#lib/types";
import { MANIFEST_ENTRY } from "./manifest.js";
import { checkZipMagic, unzip } from "./zip.js";

export interface Detected {
	kind: TransferKind;
	/** The expanded zip, so callers never pay to read the container twice. */
	entries?: Record<string, Uint8Array>;
}

/**
 * Decide what a picked file is from its bytes, not its extension. A bare
 * `.ppvz` is a zstd frame; a zip is a bundle when it carries a manifest and a
 * plain collection of archives when it does not.
 */
export function detect(data: Uint8Array): Detected {
	// `Archive.decode` tolerates an uncompressed payload, so anything that is not
	// a zip is still worth offering to the protobuf parser.
	if (!checkZipMagic(data) || ZstdCompressor.checkMagic(data)) {
		return { kind: TransferKind.Archive };
	}

	const entries = unzip(data);
	return {
		kind:
			MANIFEST_ENTRY in entries ? TransferKind.Bundle : TransferKind.ArchiveZip,
		entries,
	};
}
