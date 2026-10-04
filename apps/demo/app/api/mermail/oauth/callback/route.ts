import { NextRequest, NextResponse } from "next/server";
import {
  Client,
  IssuerMismatchError,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

import {
  createMermailOAuthProvider,
  getMermailMcpUrl,
  getOAuthState,
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

  const params = request.nextUrl.searchParams;

  const expectedState = await getOAuthState(sessionId);
  const receivedState = params.get("state");

  if (
    !expectedState ||
    !receivedState ||
    expectedState !== receivedState
  ) {
    return NextResponse.json(
      {
        error: "OAUTH_STATE_MISMATCH",
      },
      { status: 400 },
    );
  }

  if (params.get("error")) {
    return NextResponse.json(
      {
        error: "OAUTH_AUTHORIZATION_FAILED",
      },
      { status: 400 },
    );
  }

  const provider =
    createMermailOAuthProvider(sessionId);

  const authTransport =
    new StreamableHTTPClientTransport(
      getMermailMcpUrl(),
      {
        authProvider: provider,
      },
    );

  try {
    await authTransport.finishAuth(params);

    await authTransport.close().catch(() => undefined);

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

      const tools = await client.listTools();

      const payboxTools = tools.tools
        .filter((tool) =>
          tool.name.startsWith("paybox_"),
        )
        .map((tool) => tool.name);

      const response = NextResponse.json({
        connected: true,
        toolCount: tools.tools.length,
        payboxTools,
      });

      response.cookies.set(
        "mermail_oauth_session",
        sessionId,
        {
          httpOnly: true,
          secure:
            process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60,
        },
      );

      return response;
    } finally {
      await transport.close().catch(() => undefined);
      await client.close().catch(() => undefined);
    }
  } catch (error) {
    await authTransport
      .close()
      .catch(() => undefined);

    if (error instanceof IssuerMismatchError) {
      return NextResponse.json(
        {
          error: "OAUTH_ISSUER_MISMATCH",
        },
        { status: 400 },
      );
    }

    console.error(
      "Mermail OAuth callback failed:",
      error,
    );

    return NextResponse.json(
      {
        error: "OAUTH_CALLBACK_FAILED",
      },
      { status: 502 },
    );
  }
}