// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { commands } from "$lib/bindings";
import type { CollectionStateSnapshot } from "$lib/types";

export type { UpdateStatus } from "$lib/bindings";

type Result<T> = { status: "ok"; data: T } | { status: "error"; error: string };

/**
 * The generated `commands` with the `Result` wrapper peeled off: `ok` resolves
 * to the data, `error` rejects. Commands that resolve to a plain value (specta
 * emits those for infallible commands) pass through unchanged.
 */
type Unwrapped<C> = {
	[K in keyof C]: C[K] extends (...args: infer A) => Promise<Result<infer T>>
		? (...args: A) => Promise<T>
		: C[K];
};

/**
 * Specta types the snapshot's `frames`/`metadata` as `unknown`; our own type
 * carries the real proto shapes.
 */
type Ipc = Omit<Unwrapped<typeof commands>, "getCollectionSnapshot"> & {
	getCollectionSnapshot: () => Promise<CollectionStateSnapshot>;
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
 * Every backend command, unwrapped. Stays in sync with `bindings.ts` on its
 * own — a new command needs no edit here.
 */
const ipc = new Proxy(commands, {
	get(target, key: string) {
		const command = Reflect.get(target, key);
		if (typeof command !== "function") return command;
		return async (...args: unknown[]) => unwrap(await command(...args));
	},
}) as unknown as Ipc;

export default ipc;
