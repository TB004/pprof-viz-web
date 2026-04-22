export interface DBProjectRow {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
}

export interface DBProfileRow {
	id: string;
	projectId: string;
	name: string;
	url: string;
	mode: "snapshot" | "stream";
	token?: string;
	intervalSeconds?: number;
	numberOfCycles?: number;
	createdAt: number;
	updatedAt: number;
}

const DB_NAME = "pprof-viz-profiles";
const DB_VERSION = 1;
const PROJECT_STORE = "projects";
const PROFILE_STORE = "profiles";

let databasePromise: Promise<IDBDatabase> | undefined;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("IndexedDB request failed"));
	});
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () =>
			reject(transaction.error ?? new Error("IndexedDB transaction failed"));
		transaction.onabort = () =>
			reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
	});
}

function openDatabase(): Promise<IDBDatabase> {
	if (!databasePromise) {
		databasePromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onupgradeneeded = () => {
				const database = request.result;

				if (!database.objectStoreNames.contains(PROJECT_STORE)) {
					database.createObjectStore(PROJECT_STORE, { keyPath: "id" });
				}

				if (!database.objectStoreNames.contains(PROFILE_STORE)) {
					database.createObjectStore(PROFILE_STORE, { keyPath: "id" });
				}
			};

			request.onsuccess = () => resolve(request.result);
			request.onerror = () =>
				reject(request.error ?? new Error("Failed to open IndexedDB"));
			request.onblocked = () => reject(new Error("IndexedDB is blocked"));
		});
	}

	return databasePromise;
}

export async function readProjects(): Promise<DBProjectRow[]> {
	const database = await openDatabase();
	const transaction = database.transaction(PROJECT_STORE, "readonly");
	const projects = await requestToPromise<DBProjectRow[]>(
		transaction.objectStore(PROJECT_STORE).getAll(),
	);
	await transactionDone(transaction);
	return projects;
}

export async function readProfiles(): Promise<DBProfileRow[]> {
	const database = await openDatabase();
	const transaction = database.transaction(PROFILE_STORE, "readonly");
	const profiles = await requestToPromise<DBProfileRow[]>(
		transaction.objectStore(PROFILE_STORE).getAll(),
	);
	await transactionDone(transaction);
	return profiles;
}

export async function createOrUpdateProject(project: DBProjectRow) {
	const database = await openDatabase();
	const transaction = database.transaction(PROJECT_STORE, "readwrite");
	transaction.objectStore(PROJECT_STORE).put(project);
	await transactionDone(transaction);
}

export async function deleteProject(projectId: string) {
	const database = await openDatabase();
	const transaction = database.transaction(PROJECT_STORE, "readwrite");
	transaction.objectStore(PROJECT_STORE).delete(projectId);
	await transactionDone(transaction);
}

export async function createOrUpdateProfile(profile: DBProfileRow) {
	const database = await openDatabase();
	const transaction = database.transaction(PROFILE_STORE, "readwrite");
	transaction.objectStore(PROFILE_STORE).put(profile);
	await transactionDone(transaction);
}

export async function deleteProfile(profileId: string) {
	const database = await openDatabase();
	const transaction = database.transaction(PROFILE_STORE, "readwrite");
	transaction.objectStore(PROFILE_STORE).delete(profileId);
	await transactionDone(transaction);
}
