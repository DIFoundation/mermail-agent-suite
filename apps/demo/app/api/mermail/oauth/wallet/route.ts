import { NextRequest, NextResponse } from "next/server";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

import {
  createMermailOAuthProvider,
  getMermailMcpUrl,
  hasOAuthSession,
} from "../../../../../lib/mermail/oauth";

function extractToolResult(result: unknown): unknown {
  const value = result as {
    content?: Array<{
      type?: string;
      text?: string;
    }>;
    structuredContent?: unknown;
    isError?: boolean;
  };

  if (value.structuredContent !== undefined) {
    return value.structuredContent;
  }

  const text = value.content?.find(
    (item) => item.type === "text" && item.text,
  )?.text;

  if (!text) {
    return value;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

export async function GET(request: NextRequest) {
  const sessionId =
    request.cookies.get("mermail_oauth_session")?.value;

  if (!sessionId || !(await hasOAuthSession(sessionId))) {
    return NextResponse.json(
      {
        error: "OAUTH_SESSION_MISSING",
      },
      { status: 400 },
    );
  }

  const provider = createMermailOAuthProvider(sessionId);

  const client = new Client({
    name: "mermail-agent-suite",
    version: "0.1.0",
  });

  const transport = new StreamableHTTPClientTransport(
    getMermailMcpUrl(),
    {
      authProvider: provider,
    },
  );

  try {
    await client.connect(transport);

    const result = await client.callTool({
      name: "get_agent_wallet",
      arguments: {},
    });

    return NextResponse.json({
      connected: true,
      tool: "get_agent_wallet",
      result: extractToolResult(result),
    });
  } catch (error) {
    console.error(
      "Mermail Agent Wallet inspection failed:",
      error,
    );

    return NextResponse.json(
      {
        error: "AGENT_WALLET_INSPECTION_FAILED",
      },
      { status: 502 },
    );
  } finally {
    await transport.close().catch(() => undefined);
    await client.close().catch(() => undefined);
  }
}