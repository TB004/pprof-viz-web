// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { getCurrentWindow } from "@tauri-apps/api/window";
import { onMount } from "svelte";

const chrome = $state({ isMac: false, isFullscreen: false });

let subscribers = 0;
let unlisten: (() => void) | undefined;

async function listen() {
	const win = getCurrentWindow();
	chrome.isFullscreen = await win.isFullscreen();
	const stop = await win.onResized(async () => {
		chrome.isFullscreen = await win.isFullscreen();
	});
	// The last subscriber may have left while we were awaiting.
	if (subscribers === 0) stop();
	else unlisten = stop;
}

/**
 * Whether we are on macOS and whether the window is full-screen — together,
 * whether the traffic lights are on screen and need to be worked around.
 */
export function useWindowChrome() {
	onMount(() => {
		chrome.isMac = navigator.platform.startsWith("Mac");
		if (subscribers++ === 0) void listen();

		return () => {
			if (--subscribers === 0) {
				unlisten?.();
				unlisten = undefined;
			}
		};
	});

	return {
		get isMac() {
			return chrome.isMac;
		},
		get isFullscreen() {
			return chrome.isFullscreen;
		},
	};
}
