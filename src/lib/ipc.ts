// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import {
	type AppSettings,
	commands,
	type HttpVersion,
	type ProfileInput,
	type UpdateStatus,
} from "$lib/bindings";

export type { UpdateStatus };

async function run<T>(
	result: Promise<
		{ status: "ok"; data: T } | { status: "error"; error: string }
	>,
): Promise<T> {
	const r = await result;
	if (r.status === "error") throw new Error(r.error);
	return r.data;
}

export const getArch = () => commands.getArch();
export const getSettings = () => run(commands.getSettings());
export const updateSettings = (settings: AppSettings) =>
	run(commands.updateSettings(settings));
export const listProjects = () => run(commands.listProjects());
export const listProfiles = () => run(commands.listProfiles());
export const getProjectById = (id: string) => run(commands.getProjectById(id));
export const getProfileById = (id: string) => run(commands.getProfileById(id));
export const createProject = (name: string) =>
	run(commands.createProject(name));
export const renameProject = (id: string, name: string) =>
	run(commands.renameProject(id, name));
export const deleteProject = (id: string) => run(commands.deleteProject(id));
export const createProfile = (projectId: string, input: ProfileInput) =>
	run(commands.createProfile(projectId, input));
export const updateProfile = (id: string, input: ProfileInput) =>
	run(commands.updateProfile(id, input));
export const deleteProfile = (id: string) => run(commands.deleteProfile(id));
export const resetAllData = () => run(commands.resetAllData());
export const registerError = (message: string) =>
	run(commands.registerError(message));
export const getErrors = () => run(commands.getErrors());
export const clearErrors = () => run(commands.clearErrors());
export const removeError = (id: string) => run(commands.removeError(id));
export const startCollection = (profileId: string) =>
	run(commands.startCollection(profileId));
export const stopCollection = () => run(commands.stopCollection());
export const getCollectionSnapshot = () =>
	run(commands.getCollectionSnapshot());
export const saveCollection = (name: string, description: string | null) =>
	run(commands.saveCollection(name, description));
export const listCollections = () => run(commands.listCollections());
export const deleteCollection = (id: string) =>
	run(commands.deleteCollection(id));
export const updateCollection = (
	id: string,
	name: string,
	description: string | null,
) => run(commands.updateCollection(id, name, description));
export const loadCollection = (id: string) => run(commands.loadCollection(id));
export const getDiskUsage = () => run(commands.diskUsage());
export const agentPing = (
	url: string,
	token: string | null,
	httpVersion: HttpVersion,
) => run(commands.agentPing(url, token, httpVersion));
export const checkUpdate = () => run(commands.checkUpdate());
export const installUpdate = (url: string, filename: string) =>
	run(commands.installUpdate(url, filename));
export const open = (target: string) => run(commands.open(target));
