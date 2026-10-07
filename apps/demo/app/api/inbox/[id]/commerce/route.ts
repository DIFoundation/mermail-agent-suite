import {
  analyzeMessage,
  auditStore,
  extractCommerceRequest,
} from "@mermail-agent-suite/core";
import { mermailInboxProvider } from "../../../../../lib/mermail/inbox-provider";
import { createWorkflow } from "../../../../../lib/workflows";
import { initializeAuditPersistence } from "../../../../../lib/audit-persistence";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  initializeAuditPersistence();

  const { id } = await context.params;

  try {
    const message = await mermailInboxProvider.getMessage(id);

    const sentinel = analyzeMessage({
      subject: message.subject,
      body: message.body,
    });

    if (sentinel.decision !== "clear") {
      return Response.json(
        {
          status: "SECURITY_REVIEW_REQUIRED",
          sourceMessageId: message.id,
          sentinel,
        },
        { status: 409 },
      );
    }

    const extraction = extractCommerceRequest({
      subject: message.subject,
      body: message.body,
    });

    if (extraction.status === "NOT_COMMERCE") {
      return Response.json(
        {
          status: "NOT_COMMERCE",
          sourceMessageId: message.id,
          sentinel,
          extraction,
        },
        { status: 422 },
      );
    }

    if (extraction.status === "INCOMPLETE") {
      return Response.json(
        {
          status: "INCOMPLETE_COMMERCE_REQUEST",
          sourceMessageId: message.id,
          sentinel,
          extraction,
        },
        { status: 422 },
      );
    }

    const workflow = createWorkflow({
      sourceMessageId: message.id,
      service: extraction.service!,
      recipient: extraction.recipient ?? "",
      amount: extraction.amount!,
      currency: extraction.currency!,
      purpose:
        extraction.purpose ??
        (extraction.isX402 ? "x402 API payment" : "payment"),
      sentinel,
      network: "demo",
      isX402: extraction.isX402,
      x402Url: extraction.x402Url,
    });

    auditStore.createEvent(
      "workflow_created",
      workflow.request.id,
      {
        sourceMessageId: message.id,
        service: workflow.request.service,
        amount: workflow.request.amount,
        currency: workflow.request.currency,
        purpose: workflow.request.purpose,
        recipientProvided: Boolean(workflow.request.recipient),
        status: workflow.status,
        isX402: Boolean(workflow.request.isX402),
      },
    );

    return Response.json(
      {
        status: workflow.status,
        sourceMessageId: message.id,
        sentinel,
        extraction,
        workflow,
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to convert email into a commerce request.",
      },
      { status: 500 },
    );
  }
}
