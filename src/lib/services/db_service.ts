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
	createdAt: number;
	updatedAt: number;
}

const DB_NAME = "pprof-viz-profiles";
const DB_VERSION = 1;
const PROJECT_STORE = "projects";
const PROFILE_STORE = "profiles";

export class DB {
	private static databasePromise: Promise<IDBDatabase> | undefined;

	private static requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			request.onsuccess = () => resolve(request.result);
			request.onerror = () =>
				reject(request.error ?? new Error("IndexedDB request failed"));
		});
	}

	private static transactionDone(transaction: IDBTransaction): Promise<void> {
		return new Promise((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onerror = () =>
				reject(transaction.error ?? new Error("IndexedDB transaction failed"));
			transaction.onabort = () =>
				reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
		});
	}

	private static openDatabase(): Promise<IDBDatabase> {
		if (!DB.databasePromise) {
			DB.databasePromise = new Promise((resolve, reject) => {
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

		return DB.databasePromise;
	}

	static async readProjects(): Promise<DBProjectRow[]> {
		const database = await DB.openDatabase();
		const transaction = database.transaction(PROJECT_STORE, "readonly");
		const projects = await DB.requestToPromise<DBProjectRow[]>(
			transaction.objectStore(PROJECT_STORE).getAll(),
		);
		await DB.transactionDone(transaction);
		return projects;
	}

	static async readProfiles(): Promise<DBProfileRow[]> {
		const database = await DB.openDatabase();
		const transaction = database.transaction(PROFILE_STORE, "readonly");
		const profiles = await DB.requestToPromise<DBProfileRow[]>(
			transaction.objectStore(PROFILE_STORE).getAll(),
		);
		await DB.transactionDone(transaction);
		return profiles;
	}

	static async createOrUpdateProject(project: DBProjectRow) {
		const database = await DB.openDatabase();
		const transaction = database.transaction(PROJECT_STORE, "readwrite");
		transaction.objectStore(PROJECT_STORE).put(project);
		await DB.transactionDone(transaction);
	}

	static async deleteProject(projectId: string) {
		const database = await DB.openDatabase();
		const transaction = database.transaction(PROJECT_STORE, "readwrite");
		transaction.objectStore(PROJECT_STORE).delete(projectId);
		await DB.transactionDone(transaction);
	}

	static async createOrUpdateProfile(profile: DBProfileRow) {
		const database = await DB.openDatabase();
		const transaction = database.transaction(PROFILE_STORE, "readwrite");
		transaction.objectStore(PROFILE_STORE).put(profile);
		await DB.transactionDone(transaction);
	}

	static async deleteProfile(profileId: string) {
		const database = await DB.openDatabase();
		const transaction = database.transaction(PROFILE_STORE, "readwrite");
		transaction.objectStore(PROFILE_STORE).delete(profileId);
		await DB.transactionDone(transaction);
	}
}
