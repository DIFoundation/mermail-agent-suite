import { NextResponse } from "next/server";
import {
  Client,
  StreamableHTTPClientTransport,
  UnauthorizedError,
} from "@modelcontextprotocol/client";

import {
  createMermailOAuthProvider,
  createOAuthSession,
  getMermailMcpUrl,
  getOAuthAuthorizationUrl,
} from "../../../../../lib/mermail/oauth";

export async function GET() {
  const sessionId = await createOAuthSession();

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

    const tools = await client.listTools();

    await transport.terminateSession().catch(() => undefined);
    await transport.close().catch(() => undefined);
    await client.close();

    return NextResponse.json({
      connected: true,
      toolCount: tools.tools.length,
      payboxTools: tools.tools
        .filter((tool) => tool.name.startsWith("paybox_"))
        .map((tool) => tool.name),
    });
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) {
      await transport.close().catch(() => undefined);
      await client.close().catch(() => undefined);

      console.error("Mermail OAuth start failed:", error);

      return NextResponse.json(
        {
          error: "OAUTH_START_FAILED",
        },
        { status: 502 },
      );
    }

    const authorizationUrl =
      await getOAuthAuthorizationUrl(sessionId);

    await transport.close().catch(() => undefined);
    await client.close().catch(() => undefined);

    if (!authorizationUrl) {
      return NextResponse.json(
        {
          error: "OAUTH_AUTHORIZATION_URL_MISSING",
        },
        { status: 502 },
      );
    }

    const response = NextResponse.redirect(
      authorizationUrl,
    );

    response.cookies.set("mermail_oauth_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    return response;
  }
}