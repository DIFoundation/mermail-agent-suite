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

const PAYMENT_TOOLS = new Set([
  "get_agent_wallet",
  "list_agent_wallet_credentials",
  "get_agent_wallet_request",
  "create_agent_wallet_transfer_proposal",
  "submit_agent_wallet_transfer",
  "reject_agent_wallet_transfer_proposal",
  "paybox_request_transfer",
  "paybox_request_swap",
  "paybox_pay_x402",
]);

export async function GET(request: NextRequest) {
  const sessionId =
    request.cookies.get("mermail_oauth_session")?.value;

  if (!sessionId || !(await hasOAuthSession(sessionId))) {
    return NextResponse.json(
      { error: "OAUTH_SESSION_MISSING" },
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

    const result = await client.listTools();

    const tools = result.tools
      .filter((tool) => PAYMENT_TOOLS.has(tool.name))
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

    return NextResponse.json({
      connected: true,
      tools,
    });
  } catch (error) {
    console.error(
      "Mermail payment tool inspection failed:",
      error,
    );

    return NextResponse.json(
      {
        error: "PAYMENT_TOOL_INSPECTION_FAILED",
      },
      { status: 502 },
    );
  } finally {
    await transport.close().catch(() => undefined);
    await client.close().catch(() => undefined);
  }
}