// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

export const ThemeMode = {
	Light: "light",
	Dark: "dark",
	System: "system",
} as const;
export type ThemeMode = (typeof ThemeMode)[keyof typeof ThemeMode];

export const CollectionType = {
	Snapshot: "snapshot",
	Stream: "stream",
} as const;
export type CollectionType =
	(typeof CollectionType)[keyof typeof CollectionType];

export const CollectionStatus = {
	Idle: "idle",
	Running: "running",
} as const;
export type CollectionStatus =
	(typeof CollectionStatus)[keyof typeof CollectionStatus];

// --- records ---

export interface ProjectRow {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
}

/** A collection target: where to reach an agent and how to sample it. */
export interface ProfileRow {
	id: string;
	projectId: string;
	name: string;
	url: string;
	mode: CollectionType;
	token: string | null;
	intervalSeconds: number | null;
	numberOfCycles: number | null;
	createdAt: number;
	updatedAt: number;
}

export type ProfileInput = Omit<
	ProfileRow,
	"id" | "projectId" | "createdAt" | "updatedAt"
>;

/** Metadata for one archived `.ppvz` file; the payload lives in OPFS. */
export interface CollectionRow {
	id: string;
	name: string;
	description: string | null;
	filename: string;
	sizeBytes: number;
	durationMs: number;
	sampleCount: number;
	profileName: string | null;
	profileUrl: string | null;
	mode: CollectionType | null;
	createdAt: number;
}

/** Origin storage figures, from the Storage Manager API. */
export interface DiskUsage {
	/** Bytes occupied by archived collections, summed from their metadata. */
	collectionsBytes: number;
	freeBytes: number;
	totalBytes: number;
	/** False when the browser refuses an estimate, making the figures a guess. */
	estimated: boolean;
}

export interface AppSettings {
	theme: ThemeMode;
	defaultName: string;
	defaultUrl: string;
	defaultMode: CollectionType;
	defaultIntervalSeconds: number;
	defaultNumberOfCycles: number;
}

export interface AppError {
	id: string;
	message: string;
	timestamp: number;
}
