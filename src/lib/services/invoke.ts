/** Unwrap a tauri-specta typedError result, throwing on error. */
export async function run<T>(
	result: Promise<
		{ status: "ok"; data: T } | { status: "error"; error: string }
	>,
): Promise<T> {
	const r = await result;
	if (r.status === "error") throw new Error(r.error);
	return r.data;
}
