// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import {
	ActivityIcon,
	ArchiveIcon,
	BracesIcon,
	CpuIcon,
	House,
	LayersIcon,
	PackageIcon,
	RotateCcwClockIcon,
	SettingsIcon,
} from "@lucide/svelte";
import type { Component } from "svelte";

export type NavRoute = {
	title: string;
	url: string;
	icon: Component;
};

/** The telemetry dashboards — the sidebar's main menu and the home page grid. */
export const dataRoutes: NavRoute[] = [
	{ title: "CPU", url: "/cpu", icon: CpuIcon },
	{ title: "GC", url: "/gc", icon: ActivityIcon },
	{ title: "Memory", url: "/memory", icon: LayersIcon },
	{ title: "Scheduler", url: "/scheduler", icon: RotateCcwClockIcon },
	{ title: "Miscellaneous", url: "/miscellaneous", icon: PackageIcon },
	{ title: "Raw", url: "/raw", icon: BracesIcon },
];

/** Everything that isn't a dashboard, shown in the sidebar footer. */
export const shellRoutes: NavRoute[] = [
	{ title: "Home", url: "/", icon: House },
	{ title: "Archive", url: "/archive", icon: ArchiveIcon },
	{ title: "Settings", url: "/settings", icon: SettingsIcon },
];
