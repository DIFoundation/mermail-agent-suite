import { inspectInboxMessage } from "@mermail-agent-suite/core";

import { demoInboxProvider } from "../../../../lib/demo-inbox";
import { mermailInboxProvider } from "../../../../lib/mermail/inbox-provider";

function getInboxProvider() {
  return process.env.MERMAIL_INBOX_MODE === "live"
    ? mermailInboxProvider
    : demoInboxProvider;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const message = await inspectInboxMessage(
      getInboxProvider(),
      id,
    );

    return Response.json(message);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Message not found",
      },
      { status: 404 },
    );
  }
}