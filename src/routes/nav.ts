// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import {
	ArchiveIcon,
	BracesIcon,
	CpuIcon,
	HistoryIcon,
	HouseIcon,
	LayersIcon,
	PackageIcon,
	RefreshCcwIcon,
	SettingsIcon,
} from "@lucide/svelte";
import type { Component } from "svelte";

export type NavRoute = {
	title: string;
	url: string;
	icon: Component;
};

export const overviewRoute: NavRoute = {
	title: "Overview",
	url: "/",
	icon: HouseIcon,
};

/** The telemetry dashboards. */
export const dashboardRoutes: NavRoute[] = [
	{ title: "CPU", url: "/cpu", icon: CpuIcon },
	{ title: "GC", url: "/gc", icon: RefreshCcwIcon },
	{ title: "Memory", url: "/memory", icon: LayersIcon },
	{ title: "Scheduler", url: "/scheduler", icon: HistoryIcon },
	{ title: "Miscellaneous", url: "/miscellaneous", icon: PackageIcon },
];

/** The current session's frames, and what is kept in this browser. */
export const dataRoutes: NavRoute[] = [
	{ title: "Raw frames", url: "/raw", icon: BracesIcon },
	{ title: "Archive", url: "/archive", icon: ArchiveIcon },
];

export const settingsRoute: NavRoute = {
	title: "Settings",
	url: "/settings",
	icon: SettingsIcon,
};

/** Pages that show the current session, as opposed to stored data. */
export const sessionUrls = new Set([
	overviewRoute.url,
	...dashboardRoutes.map((r) => r.url),
	"/raw",
]);

export const allRoutes: NavRoute[] = [
	overviewRoute,
	...dashboardRoutes,
	...dataRoutes,
	settingsRoute,
];
