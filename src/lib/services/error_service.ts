import { writable, type Readable } from "svelte/store";

export interface CollectionError {
	id: string;
	message: string;
	timestamp: number;
}

const errorStore = writable<CollectionError[]>([]);

export const errorState: Readable<CollectionError[]> = {
	subscribe: errorStore.subscribe,
};

export class ErrorService {
	static subscribe = errorStore.subscribe;

	static formatErrorTimestamp(timestamp: number): string {
		return new Intl.DateTimeFormat("en-US", {
			weekday: "long",
			month: "long",
			day: "2-digit",
			year: "numeric",
			hour: "numeric",
			minute: "2-digit",
			second: "2-digit",
		}).format(new Date(timestamp));
	}

	static registerError(message: string) {
		errorStore.update((value) => [
			{
				id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				message,
				timestamp: Date.now(),
			},
			...value,
		]);
	}

	static removeError(errorId: string) {
		errorStore.update((value) => value.filter((error) => error.id !== errorId));
	}
}
