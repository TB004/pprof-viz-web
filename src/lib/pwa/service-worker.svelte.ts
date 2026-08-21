// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { browser } from "$app/environment";

export interface ServiceWorkerState {
	supported: boolean;
	ready: boolean;
	updateReady: boolean;
	checking: boolean;
	installed: boolean;
}

export const serviceWorkerState: ServiceWorkerState = $state({
	supported: false,
	ready: false,
	updateReady: false,
	checking: false,
	installed: false,
});

let registration: ServiceWorkerRegistration | undefined;

let reloading = false;

function watchInstalling(worker: ServiceWorker | null): void {
	if (!worker) return;
	worker.addEventListener("statechange", () => {
		if (worker.state === "installed" && navigator.serviceWorker.controller) {
			serviceWorkerState.updateReady = true;
		}
	});
}

async function observe(): Promise<void> {
	registration = await navigator.serviceWorker.ready;
	serviceWorkerState.ready = true;
	if (registration.waiting) serviceWorkerState.updateReady = true;

  watchInstalling(registration.installing);

	registration.addEventListener("updatefound", () =>
		watchInstalling(registration?.installing ?? null),
	);

	navigator.serviceWorker.addEventListener("controllerchange", () => {
		if (!reloading) return;
		reloading = false;
		window.location.reload();
	});
}

if (browser) {
	serviceWorkerState.supported = "serviceWorker" in navigator;
	serviceWorkerState.installed =
		window.matchMedia("(display-mode: standalone)").matches ||
		(navigator as { standalone?: boolean }).standalone === true;

	if (serviceWorkerState.supported) void observe().catch(() => {});
}

export async function checkForUpdate(): Promise<void> {
	if (!registration) return;
	serviceWorkerState.checking = true;
	try {
		await registration.update();
	} finally {
		serviceWorkerState.checking = false;
	}
}

export function applyUpdate(): void {
	const waiting = registration?.waiting;
	if (!waiting) return;
	reloading = true;
	waiting.postMessage({ type: "skip-waiting" });
}
