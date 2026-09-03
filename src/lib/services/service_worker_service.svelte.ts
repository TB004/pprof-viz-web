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

export class ServiceWorkerService {
	readonly #state: ServiceWorkerState = $state({
		supported: false,
		ready: false,
		updateReady: false,
		checking: false,
		installed: false,
	});

	#registration: ServiceWorkerRegistration | undefined;
	#reloading = false;

	constructor() {
		if (!browser) return;

		this.#state.supported = "serviceWorker" in navigator;
		this.#state.installed =
			window.matchMedia("(display-mode: standalone)").matches ||
			(navigator as { standalone?: boolean }).standalone === true;

		if (this.#state.supported) void this.#observe().catch(() => {});
	}

	getState(): ServiceWorkerState {
		return this.#state;
	}

	async checkForUpdate(): Promise<void> {
		if (!this.#registration) return;
		this.#state.checking = true;
		try {
			await this.#registration.update();
		} finally {
			this.#state.checking = false;
		}
	}

	applyUpdate(): void {
		const waiting = this.#registration?.waiting;
		if (!waiting) return;
		this.#reloading = true;
		waiting.postMessage({ type: "skip-waiting" });
	}

	async #observe(): Promise<void> {
		const registration = await navigator.serviceWorker.ready;
		this.#registration = registration;
		this.#state.ready = true;
		if (registration.waiting) this.#state.updateReady = true;

		this.#watchInstalling(registration.installing);

		registration.addEventListener("updatefound", () =>
			this.#watchInstalling(registration.installing),
		);

		navigator.serviceWorker.addEventListener("controllerchange", () => {
			if (!this.#reloading) return;
			this.#reloading = false;
			window.location.reload();
		});
	}

	#watchInstalling(worker: ServiceWorker | null): void {
		if (!worker) return;
		worker.addEventListener("statechange", () => {
			if (worker.state === "installed" && navigator.serviceWorker.controller) {
				this.#state.updateReady = true;
			}
		});
	}
}
