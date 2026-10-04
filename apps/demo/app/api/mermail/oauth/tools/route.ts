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

  const provider =
    createMermailOAuthProvider(sessionId);

  const client = new Client({
    name: "mermail-agent-suite",
    version: "0.1.0",
  });

  const transport =
    new StreamableHTTPClientTransport(
      getMermailMcpUrl(),
      {
        authProvider: provider,
      },
    );

  try {
    await client.connect(transport);

    const result = await client.listTools();

    return NextResponse.json({
      connected: true,
      toolCount: result.tools.length,
      tools: result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
      payboxTools: result.tools
        .filter((tool) =>
          tool.name.startsWith("paybox_"),
        )
        .map((tool) => tool.name),
      walletTools: result.tools
        .filter((tool) =>
          tool.name.toLowerCase().includes("wallet"),
        )
        .map((tool) => tool.name),
    });
  } catch (error) {
    console.error(
      "Mermail OAuth tools inspection failed:",
      error,
    );

    return NextResponse.json(
      {
        error: "OAUTH_TOOLS_INSPECTION_FAILED",
      },
      { status: 502 },
    );
  } finally {
    await transport.close().catch(() => undefined);
    await client.close().catch(() => undefined);
  }
}