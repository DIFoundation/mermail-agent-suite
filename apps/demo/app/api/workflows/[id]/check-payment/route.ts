import { NextRequest, NextResponse } from "next/server";
import {
  auditStore,
  completeExecution,
  failExecution,
} from "@mermail-agent-suite/core";
import { getWorkflow, saveWorkflow } from "../../../../../lib/workflows";
import { getMermailPaymentStatus } from "../../../../../lib/mermail-payment-status";

function isTerminalSuccess(status: unknown) {
  return (
    status === "success" ||
    status === "completed" ||
    status === "settled"
  );
}

function isTerminalFailure(status: unknown) {
  return (
    status === "denied" ||
    status === "error" ||
    status === "failed"
  );
}

function isPending(status: unknown) {
  return (
    status === "pending_approval" ||
    status === "pending_signature" ||
    status === "pending_confirmation" ||
    status === "pending_settlement"
  );
}

function getPayBoxStatus(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const status = (value as { status?: unknown }).status;

  return typeof status === "string" ? status : undefined;
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const { id } = await context.params;

  const workflow = getWorkflow(id);

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  if (workflow.status !== "EXECUTING") {
    return NextResponse.json(
      {
        error: "Payment status check requires EXECUTING workflow",
        status: workflow.status,
      },
      { status: 409 },
    );
  }

  if (!workflow.executionId) {
    return NextResponse.json(
      { error: "Workflow has no execution ID" },
      { status: 400 },
    );
  }

  const sessionId = request.cookies.get("mermail_oauth_session")?.value;

  if (!sessionId) {
    return NextResponse.json(
      {
        error: "Mermail OAuth session is required for payment status check",
      },
      { status: 401 },
    );
  }

  try {
    const paymentStatus = await getMermailPaymentStatus(
      sessionId,
      workflow.executionId,
    );

    const status = getPayBoxStatus(paymentStatus);

    if (!status) {
      return NextResponse.json(
        { error: "Payment status not available" },
        { status: 502 },
      );
    }

    if (isTerminalSuccess(status)) {
      const completed = completeExecution(workflow, workflow.executionId);

      if (!completed.ok) {
        return NextResponse.json({ error: completed.error }, { status: 500 });
      }

      saveWorkflow(completed.workflow);

      // Log audit event for payment settlement
      auditStore.createEvent(
        "payment_settled",
        completed.workflow.id,
        {
          executionId: completed.workflow.executionId,
          status,
        },
      );

      // Log audit event for workflow completion
      auditStore.createEvent(
        "workflow_completed",
        completed.workflow.id,
        {
          executionId: completed.workflow.executionId,
        },
      );

      return NextResponse.json({
        workflow: completed.workflow,
        paymentStatus,
        status: "COMPLETED",
      });
    }

    if (isTerminalFailure(status)) {
      const failed = failExecution(
        workflow,
        `Payment failed with status: ${status}`,
      );

      saveWorkflow(failed.workflow);

      // Log audit event for payment failure
      auditStore.createEvent(
        "payment_failed",
        failed.workflow.id,
        {
          reason: failed.workflow.failureReason,
          status,
        },
      );

      // Log audit event for workflow failure
      auditStore.createEvent(
        "workflow_failed",
        failed.workflow.id,
        {
          reason: failed.workflow.failureReason,
        },
      );

      return NextResponse.json({
        workflow: failed.workflow,
        paymentStatus,
        status: "FAILED",
      });
    }

    // Handle unknown statuses safely - treat as pending but log warning
    if (!isPending(status)) {
      return NextResponse.json(
        {
          workflow,
          paymentStatus,
          status: "PENDING",
          warning: `Unknown PayBox status: ${status}. Treating as pending.`,
        },
        { status: 200 },
      );
    }

    // Still pending
    return NextResponse.json({
      workflow,
      paymentStatus,
      status: "PENDING",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Payment status check failed",
      },
      { status: 502 },
    );
  }
}
