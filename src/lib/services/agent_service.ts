// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { CollectorClient, describeError } from "#lib/rpc/collector.js";

/**
 * Reachability check for a profile being edited. Resolves when the agent
 * answers `Ping`, rejects with a message the form can show verbatim.
 */
export async function pingAgent(
	url: string,
	token: string | null,
): Promise<void> {
	try {
		await new CollectorClient({ baseUrl: url, token }).ping();
	} catch (error) {
		throw new Error(describeError(error, url));
	}
}
