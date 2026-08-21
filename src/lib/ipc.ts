// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { commands as agent } from "$lib/generated/agent";
import { commands as archive } from "$lib/generated/archive";
import { commands as collection } from "$lib/generated/collection";
import { commands as error } from "$lib/generated/error";
import { commands as opener } from "$lib/generated/opener";
import { commands as profile } from "$lib/generated/profile";
import { commands as project } from "$lib/generated/project";
import { commands as settings } from "$lib/generated/settings";
import { commands as update } from "$lib/generated/update";
import type { CollectionStateSnapshot } from "$lib/types";

export type { UpdateStatus } from "$lib/generated/update";

type Result<T> = { status: "ok"; data: T } | { status: "error"; error: string };

/**
 * A generated `commands` object with the `Result` wrapper peeled off: `ok`
 * resolves to the data, `error` rejects. Commands that resolve to a plain value
 * (specta emits those for infallible commands) pass through unchanged.
 */
type Unwrapped<C> = {
	[K in keyof C]: C[K] extends (...args: infer A) => Promise<Result<infer T>>
		? (...args: A) => Promise<T>
		: C[K];
};

function unwrap(value: unknown): unknown {
	if (
		typeof value === "object" &&
		value !== null &&
		"status" in value &&
		(value.status === "ok" || value.status === "error")
	) {
		const result = value as Result<unknown>;
		if (result.status === "error") throw new Error(result.error);
		return result.data;
	}
	return value;
}

/**
 * Wrap one service's generated commands. Stays in sync with the generated file
 * on its own — a new command in that service needs no edit here.
 */
function unwrapped<C extends object>(commands: C): Unwrapped<C> {
	return new Proxy(commands, {
		get(target, key: string) {
			const command = Reflect.get(target, key);
			if (typeof command !== "function") return command;
			return async (...args: unknown[]) => unwrap(await command(...args));
		},
	}) as Unwrapped<C>;
}

export const AgentIpc = unwrapped(agent);
export const ArchiveIpc = unwrapped(archive);
export const ErrorIpc = unwrapped(error);
export const OpenerIpc = unwrapped(opener);
export const ProfileIpc = unwrapped(profile);
export const ProjectIpc = unwrapped(project);
export const SettingsIpc = unwrapped(settings);
export const UpdateIpc = unwrapped(update);

/**
 * Specta types the snapshot's `frames`/`metadata` as `unknown`; our own type
 * carries the real proto shapes.
 */
type CollectionCommands = Omit<
	Unwrapped<typeof collection>,
	"getCollectionSnapshot"
> & {
	getCollectionSnapshot: () => Promise<CollectionStateSnapshot>;
};

export const CollectionIpc = unwrapped(
	collection,
) as unknown as CollectionCommands;
