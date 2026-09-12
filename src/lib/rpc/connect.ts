// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import {
	Code,
	ConnectError,
	type Interceptor,
	type Transport,
} from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

export interface TransportOptions {
	baseUrl: string;
	token?: string | null;
}

/** Validate a hand-typed collector URL before the first request is made. */
function normalizeBaseUrl(baseUrl: string): string {
	const trimmed = baseUrl.trim();
	if (!trimmed) {
		throw new ConnectError("missing collector url", Code.InvalidArgument);
	}
	// `new URL` rejects the malformed values a hand-typed host can produce.
	const parsed = new URL(trimmed);
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new ConnectError(
			`unsupported scheme "${parsed.protocol.replace(":", "")}"`,
			Code.InvalidArgument,
		);
	}
	return trimmed.replace(/\/+$/, "");
}

export function createTransport(opt: TransportOptions): Transport {
	const trimmed = opt.token?.trim();

	const itc: Interceptor = (next) => (request) => {
		request.header.set("authorization", `Bearer ${trimmed}`);
		return next(request);
	};

	return createConnectTransport({
		baseUrl: normalizeBaseUrl(opt.baseUrl),
		useBinaryFormat: true,
		interceptors: trimmed ? [itc] : [],
	});
}

/** True for the codes a deliberate stop produces, which are not failures. */
export function isCancellation(error: unknown): boolean {
	const code = ConnectError.from(error).code;
	return code === Code.Canceled || code === Code.DeadlineExceeded;
}

/** The collector's origin, for error text; undefined if `baseUrl` is unusable. */
function originOf(baseUrl: string | undefined): string | undefined {
	if (!baseUrl) return undefined;
	try {
		return new URL(baseUrl.trim()).origin;
	} catch {
		return undefined;
	}
}

/** A message fit to show a user. */
export function describeError(error: unknown, baseUrl?: string): string {
	const connect = ConnectError.from(error);
	const transportFailure =
		(connect.code === Code.Unavailable || connect.code === Code.Unknown) &&
		connect.cause !== undefined &&
		!(connect.cause instanceof ConnectError);
	if (transportFailure) {
		const origin =
			typeof location === "undefined" ? "this origin" : location.origin;
		const message = `cannot reach the collector — check the URL, that it is running, and that it allows requests from ${origin}`;
		const collector = originOf(baseUrl);
		if (collector?.startsWith("https:")) {
			return `${message}. If it uses a self-signed certificate, open ${collector} in a new tab and accept the certificate warning once, then try again`;
		}
		return message;
	}
	return connect.rawMessage;
}

export { Code, ConnectError };
