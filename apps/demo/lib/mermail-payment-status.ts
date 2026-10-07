import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

import {
  createMermailOAuthProvider,
  getMermailMcpUrl,
  hasOAuthSession,
} from "./mermail/oauth";

interface ToolResult {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  structuredContent?: unknown;
  isError?: boolean;
}

function extractToolResult(result: ToolResult): unknown {
  if (result.structuredContent !== undefined) {
    return result.structuredContent;
  }

  const text = result.content?.find(
    (item) => item.type === "text" && item.text,
  )?.text;

  if (!text) {
    return result;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

export async function getMermailPaymentStatus(
  sessionId: string,
  requestId: string,
): Promise<unknown> {
  if (!(await hasOAuthSession(sessionId))) {
    throw new Error("Mermail OAuth session is missing or expired.");
  }

  const client = new Client({
    name: "mermail-agent-suite",
    version: "0.1.0",
  });

  const transport = new StreamableHTTPClientTransport(getMermailMcpUrl(), {
    authProvider: createMermailOAuthProvider(sessionId),
  });

  try {
    await client.connect(transport);

    const result = await client.callTool({
      name: "paybox_get_request",
      arguments: {
        request_id: requestId,
      },
    });

    return extractToolResult(result);
  } finally {
    await transport.close().catch(() => undefined);

    await client.close().catch(() => undefined);
  }
}

export async function getMermailPayBoxInvocation(
  sessionId: string,
  invocationId: string,
): Promise<unknown> {
  if (!(await hasOAuthSession(sessionId))) {
    throw new Error("Mermail OAuth session is missing or expired.");
  }

  const client = new Client({
    name: "mermail-agent-suite",
    version: "0.1.0",
  });

  const transport = new StreamableHTTPClientTransport(
    getMermailMcpUrl(),
    {
      authProvider: createMermailOAuthProvider(sessionId),
    },
  );

  try {
    await client.connect(transport);

    const result = await client.callTool({
      name: "get_paybox_invocation",
      arguments: {
        invocation_id: invocationId,
      },
    });

    return extractToolResult(result);
  } finally {
    await transport.close().catch(() => undefined);
    await client.close().catch(() => undefined);
  }
}
