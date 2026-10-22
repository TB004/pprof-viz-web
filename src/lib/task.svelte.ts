// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

import { errorMessage } from "#lib/utils";

/**
 * One user action as a component sees it: whether it is running, and why it
 * last failed. Services throw; the component that started the action owns one
 * of these and shows `error` next to the control that triggered it, so a
 * failure inside a dialog is reported inside that dialog.
 */
export class Task {
	pending = $state(false);
	error = $state<string | null>(null);

	/** Run `action`, resolving to whether it succeeded. Ignored while pending. */
	async run(action: () => Promise<unknown>): Promise<boolean> {
		if (this.pending) return false;
		this.pending = true;
		this.error = null;
		try {
			await action();
			return true;
		} catch (error) {
			this.error = errorMessage(error);
			return false;
		} finally {
			this.pending = false;
		}
	}

	/** Forget the last failure, e.g. when the dialog showing it is reopened. */
	reset(): void {
		this.error = null;
	}
}
