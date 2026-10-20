// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter({
				pages: "build",
				assets: "build",
				fallback: undefined,
				precompress: false,
				strict: true,
			}),
			dynamicCompileOptions: ({ filename }) =>
				filename.includes("node_modules") ? undefined : { runes: true },
		}),
	],
	// Scoped to the client: SvelteKit builds the service worker as its own
	// environment with code splitting off. SvelteKit also sets `codeSplitting`
	// for the client, which makes Rolldown ignore `manualChunks`, so the chart
	// libraries are grouped here instead. Vite merges this with SvelteKit's groups.
	environments: {
		client: {
			build: {
				// The charts group is ~630 kB minified (~190 kB gzipped) by design.
				chunkSizeWarningLimit: 700,
				rolldownOptions: {
					output: {
						codeSplitting: {
							groups: [{ name: "charts", test: /layerchart|[\\/]d3-/ }],
						},
					},
				},
			},
		},
	},
});
