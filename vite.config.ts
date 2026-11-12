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
});
