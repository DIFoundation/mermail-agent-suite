import { attachQuote, type CommerceWorkflow } from "@mermail-agent-suite/core";

import { getWorkflow, saveWorkflow } from "../../../../../lib/workflows";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const { id } = await context.params;

  try {
    const body = await request.json();

    const recipient =
      typeof body.recipient === "string" ? body.recipient.trim() : "";

    if (!recipient) {
      return Response.json(
        {
          error: "Payment recipient is required.",
        },
        { status: 400 },
      );
    }

    const workflow = getWorkflow(id);

    if (!workflow) {
      return Response.json(
        {
          error: "Workflow not found.",
        },
        { status: 404 },
      );
    }

    if (workflow.status !== "DETAILS_REQUIRED") {
      return Response.json(
        {
          error: "This workflow does not require payment details.",
        },
        { status: 409 },
      );
    }

    const updated: CommerceWorkflow = {
      ...workflow,
      request: {
        ...workflow.request,
        recipient,
      },
      status: "CLEARED",
      updatedAt: new Date().toISOString(),
    };

    const quoted = attachQuote(updated, {
      quoteId: `quote-${crypto.randomUUID()}`,
      requestId: updated.request.id,
      service: updated.request.service,
      recipient,
      amount: updated.request.amount,
      currency: updated.request.currency,
      purpose: updated.request.purpose,
      network: updated.request.network,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    if (!quoted.ok) {
      return Response.json(
        {
          error: quoted.error,
        },
        { status: 400 },
      );
    }

    saveWorkflow(quoted.workflow);

    return Response.json(quoted.workflow);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save payment details.",
      },
      { status: 400 },
    );
  }
}
