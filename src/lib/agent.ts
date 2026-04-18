import { type Client, createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { AgentService } from "$lib/proto/gen/agent_pb";

export function createAgentClient(url: string): Client<typeof AgentService> {
	return createClient(
		AgentService,
		createConnectTransport({
			baseUrl: url,
			useBinaryFormat: true,
		}),
	);
}
