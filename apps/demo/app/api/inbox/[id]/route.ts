import { inspectInboxMessage } from "@mermail-agent-suite/core";
import { demoInboxProvider } from "../../../../lib/demo-inbox";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const message = await inspectInboxMessage(
      demoInboxProvider,
      id,
    );

    return Response.json(message);
  } catch {
    return Response.json(
      { error: "Message not found" },
      { status: 404 },
    );
  }
}
