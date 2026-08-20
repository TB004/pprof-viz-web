// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("layerchart") || id.includes("/d3-")) {
						return "charts";
					}
				},
			},
		},
	},
	server: {
		watch: {
			// `target/` holds cargo output and the flatpak-builder sandbox, whose
			// staged /var/run/udev/watch entries are symlink loops that make the
			// dev watcher crash with ELOOP.
			ignored: ["**/target/**", "**/src-tauri/target/**"],
		},
	},
});
