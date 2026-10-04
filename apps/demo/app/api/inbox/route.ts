import { inspectInbox } from "@mermail-agent-suite/core";

import { demoInboxProvider } from "../../../lib/demo-inbox";
import { mermailInboxProvider } from "../../../lib/mermail/inbox-provider";

function getInboxProvider() {
  return process.env.MERMAIL_INBOX_MODE === "live"
    ? mermailInboxProvider
    : demoInboxProvider;
}

export async function GET() {
  const provider = getInboxProvider();

  const result = await inspectInbox(provider, {
    limit: 20,
  });

  return Response.json({
    source:
      process.env.MERMAIL_INBOX_MODE === "live"
        ? "mermail"
        : "demo",
    messages: result.messages,
    nextCursor: result.nextCursor ?? null,
  });
}