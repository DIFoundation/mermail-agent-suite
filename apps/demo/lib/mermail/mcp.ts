import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

const MERMAIL_MCP_URL =
  process.env.MERMAIL_MCP_URL ??
  "https://console.mermail.app/mcp";

const MERMAIL_API_KEY = process.env.MERMAIL_API_KEY;

export interface MermailToolSummary {
  name: string;
  description?: string;
}

export interface MermailConnectionInfo {
  connected: boolean;
  server: {
    name?: string;
    version?: string;
  };
  protocolVersion?: string;
  tools: MermailToolSummary[];
}

function requireApiKey(): string {
  if (!MERMAIL_API_KEY) {
    throw new Error(
      "MERMAIL_API_KEY is required for the Mermail MCP connection",
    );
  }

  return MERMAIL_API_KEY;
}

export async function connectToMermail(): Promise<{
  client: Client;
  transport: StreamableHTTPClientTransport;
}> {
  const apiKey = requireApiKey();

  const client = new Client({
    name: "mermail-agent-suite",
    version: "0.1.0",
  });

  const transport = new StreamableHTTPClientTransport(
    new URL(MERMAIL_MCP_URL),
    {
      requestInit: {
        headers: {
          "x-api-key": apiKey,
        },
      },
    },
  );

  await client.connect(transport);

  return {
    client,
    transport,
  };
}

export async function inspectMermailConnection(): Promise<MermailConnectionInfo> {
  const { client, transport } = await connectToMermail();

  try {
    const result = await client.listTools();

    const serverVersion = client.getServerVersion();

    return {
      connected: true,
      server: {
        name: serverVersion?.name,
        version: serverVersion?.version,
      },
      protocolVersion: client.getProtocolEra(),
      tools: result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
    };
  } finally {
    await transport.terminateSession().catch(() => undefined);
    await client.close();
  }
}
