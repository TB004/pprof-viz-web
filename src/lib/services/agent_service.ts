import { create } from "@bufbuild/protobuf";
import { type Client, createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import {
	AgentService as AgentServiceDef,
	type AllResponse,
	type MetadataResponse,
	StreamConfigRequestSchema,
} from "$lib/proto/gen/agent_pb";

export class AgentService {
	private readonly client: Client<typeof AgentServiceDef>;

	constructor(url: string) {
		this.client = createClient(
			AgentServiceDef,
			createConnectTransport({
				baseUrl: url,
				useBinaryFormat: true,
			}),
		);
	}

	/**
	 * Sends a ping to the agent and returns when it responds.
	 * Used to verify the agent is reachable at the configured URL.
	 */
	async ping(): Promise<void> {
		await this.client.ping({});
	}

	/**
	 * Captures a single point-in-time snapshot of all runtime metrics.
	 */
	async snapshotAll(): Promise<AllResponse> {
		return await this.client.snapshotAll({});
	}

	/**
	 * Opens a server-sent stream of runtime metrics.
	 * The stream emits one AllResponse per interval until numberOfCycles
	 * is reached, or indefinitely when numberOfCycles is 0.
	 *
	 * @param intervalSeconds - Polling interval in seconds (>= 1)
	 * @param numberOfCycles  - Number of measurements; 0 means infinite
	 */
	streamAll(
		intervalSeconds: number,
		numberOfCycles: number,
	): AsyncIterable<AllResponse> {
		const request = create(StreamConfigRequestSchema, {
			intervalSeconds,
			numberOfCycles,
		});
		return this.client.streamAll(request);
	}

	/**
	 * Fetches static metadata about the agent (histogram bucket boundaries, etc.).
	 * Should be called once per session before interpreting histogram data.
	 */
	async getMetadata(): Promise<MetadataResponse> {
		return await this.client.getMetadata({});
	}
}
