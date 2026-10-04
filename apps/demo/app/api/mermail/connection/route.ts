import { NextResponse } from "next/server";

import { inspectMermailConnection } from "../../../../lib/mermail/mcp";

export async function GET() {
  try {
    const connection = await inspectMermailConnection();

    return NextResponse.json(connection);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Mermail MCP connection failed";

    return NextResponse.json(
      {
        connected: false,
        error: message,
      },
      { status: 502 },
    );
  }
}