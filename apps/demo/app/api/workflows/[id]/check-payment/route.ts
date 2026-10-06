import { NextRequest, NextResponse } from "next/server";
import {
  auditStore,
  completeExecution,
  failExecution,
} from "@mermail-agent-suite/core";
import { getWorkflow, saveWorkflow } from "../../../../../lib/workflows";
import { getMermailPaymentStatus } from "../../../../../lib/mermail-payment-status";

function getPayBoxStatus(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const status = (
    value as {
      status?: unknown;
    }
  ).status;

  return typeof status === "string" ? status : undefined;
}

function isTerminalSuccess(status: string): boolean {
  /*
   * Current PayBox terminal success.
   */
  return status === "success";
}

function isTerminalFailure(status: string): boolean {
  return status === "denied" || status === "error";
}

function isPending(status: string): boolean {
  return (
    status === "pending_execution" ||
    status === "pending_approval" ||
    status === "pending_signature" ||
    status === "pending_confirmation" ||
    status === "pending_settlement"
  );
}

function isRecoveryRequired(status: string): boolean {
  return status === "recovery_required";
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
    return NextResponse.json(
      {
        error: "Workflow not found",
      },
      { status: 404 },
    );
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
      {
        error: "Workflow has no execution ID",
      },
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
        {
          error: "Payment status not available",
        },
        { status: 502 },
      );
    }

    /*
     * Explicit terminal success only.
     */
    if (isTerminalSuccess(status)) {
      const completed = completeExecution(workflow, workflow.executionId);

      if (!completed.ok) {
        return NextResponse.json(
          {
            error: completed.error,
          },
          { status: 500 },
        );
      }

      saveWorkflow(completed.workflow);

      auditStore.createEvent("payment_settled", completed.workflow.id, {
        executionId: completed.workflow.executionId,
        status,
      });

      auditStore.createEvent("workflow_completed", completed.workflow.id, {
        executionId: completed.workflow.executionId,
      });

      return NextResponse.json({
        workflow: completed.workflow,
        paymentStatus,
        status: "COMPLETED",
      });
    }

    /*
     * Explicit terminal failure.
     */
    if (isTerminalFailure(status)) {
      const failed = failExecution(
        workflow,
        `Payment failed with status: ${status}`,
      );

      saveWorkflow(failed.workflow);

      auditStore.createEvent("payment_failed", failed.workflow.id, {
        reason: failed.workflow.failureReason,
        status,
      });

      auditStore.createEvent("workflow_failed", failed.workflow.id, {
        reason: failed.workflow.failureReason,
      });

      return NextResponse.json({
        workflow: failed.workflow,
        paymentStatus,
        status: "FAILED",
      });
    }

    /*
     * PayBox explicitly requires owner recovery.
     *
     * Do not call this ordinary pending.
     */
    if (isRecoveryRequired(status)) {
      const failed = failExecution(
        workflow,
        "PayBox requires recovery or owner intervention.",
      );

      saveWorkflow(failed.workflow);

      auditStore.createEvent("payment_failed", failed.workflow.id, {
        reason: failed.workflow.failureReason,
        status,
      });

      return NextResponse.json({
        workflow: failed.workflow,
        paymentStatus,
        status: "RECOVERY_REQUIRED",
      });
    }

    /*
     * Known pending states.
     */
    if (isPending(status)) {
      return NextResponse.json({
        workflow,
        paymentStatus,
        status: "PENDING",
      });
    }

    /*
     * SECURITY IMPORTANT:
     *
     * Unknown provider states must NOT become
     * PENDING and must definitely not become
     * COMPLETED.
     */
    return NextResponse.json(
      {
        error: `Unknown PayBox status: ${status}`,
        workflow,
        paymentStatus,
        status: "UNKNOWN",
      },
      { status: 502 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Payment status check failed",
      },
      { status: 502 },
    );
  }
}
