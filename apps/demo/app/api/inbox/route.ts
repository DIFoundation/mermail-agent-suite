import { inspectInbox } from "@mermail-agent-suite/core";
import { demoInboxProvider } from "../../../lib/demo-inbox";

export async function GET() {
  const result = await inspectInbox(demoInboxProvider, {
    limit: 20,
  });

  return Response.json({
    messages: result.messages,
    nextCursor: result.nextCursor ?? null,
  });
}
