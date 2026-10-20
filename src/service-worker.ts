// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

/// <reference types="@sveltejs/kit" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { version } from "$app/env";
import { assets, immutable, prerendered } from "$app/manifest";

const sw = self as unknown as ServiceWorkerGlobalScope;

/** Versioned so a deploy never serves a mix of old and new assets. */
const CACHE = `pprof-viz-${version}`;

/**
 * The worker's scope is the app's base path, so resolving against it keeps
 * everything correct when the app is served from a sub-path. Manifest paths
 * are relative to the base, with the empty string standing for the root.
 */
const SCOPE = sw.registration.scope;

/** Everything the app needs to boot: hashed chunks, static assets, routes. */
const PRECACHE = [...immutable, ...assets, ...prerendered].map(
	(entry) => new URL(entry.path, SCOPE).href,
);

const IMMUTABLE_PREFIX = new URL("_app/immutable/", SCOPE).pathname;

sw.addEventListener("install", (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

sw.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})(),
	);
});

/**
 * The app decides when a waiting worker takes over, so the user is never
 * swapped onto a new build mid-collection.
 */
sw.addEventListener("message", (event) => {
	if ((event.data as { type?: string })?.type === "skip-waiting") {
		void sw.skipWaiting();
	}
});

async function cacheFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	const hit = await cache.match(request);
	if (hit) return hit;

	const response = await fetch(request);
	if (response.ok && response.type === "basic") {
		await cache.put(request, response.clone());
	}
	return response;
}

/**
 * Fresh when online, cached when not. Used for navigations and for anything
 * else whose URL is not content-hashed.
 */
async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	try {
		const response = await fetch(request);
		if (response.ok && response.type === "basic") {
			await cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		const hit = await cache.match(request);
		if (hit) return hit;
		// Any route renders the same shell, so the entry point is a valid
		// offline answer for a navigation to a page we have not cached.
		if (request.mode === "navigate") {
			const shell = await cache.match(SCOPE);
			if (shell) return shell;
		}
		throw error;
	}
}

sw.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	// Leave cross-origin traffic — the collector above all — to the network.
	if (url.origin !== location.origin) return;

	event.respondWith(
		url.pathname.startsWith(IMMUTABLE_PREFIX)
			? cacheFirst(request)
			: networkFirst(request),
	);
});
