import { NextRequest, NextResponse } from "next/server";
import {
  completeExecution,
  failExecution,
} from "@mermail-agent-suite/core";
import { getWorkflow, saveWorkflow } from "../../../../../lib/workflows";
import { getMermailPaymentStatus } from "../../../../../lib/mermail-payment-status";

function isTerminalSuccess(status: unknown) {
  return (
    status === "completed" ||
    status === "settled" ||
    status === "confirmed" ||
    status === "success" ||
    status === "SUCCESS"
  );
}

function isTerminalFailure(status: unknown) {
  return (
    status === "failed" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "canceled" ||
    status === "FAILED"
  );
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

    const status = paymentStatus;

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

      return NextResponse.json({
        workflow: failed.workflow,
        paymentStatus,
        status: "FAILED",
      });
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
