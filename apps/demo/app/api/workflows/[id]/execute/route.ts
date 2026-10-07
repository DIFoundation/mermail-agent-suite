import { NextRequest, NextResponse } from "next/server";
import {
  auditStore,
  beginExecution,
  completeExecution,
  failExecution,
  markSubmissionUnknown,
} from "@mermail-agent-suite/core";
import { getWorkflow, saveWorkflow } from "../../../../../lib/workflows";
import { MermailPaymentExecutor } from "../../../../../lib/mermail-payment-executor";
import { getMermailPaymentStatus } from "../../../../../lib/mermail-payment-status";

function getPaymentConfig() {
  const chain = process.env.MERMAIL_PAYMENT_CHAIN;
  const credentialId = process.env.MERMAIL_PAYMENT_CREDENTIAL_ID;
  const token = process.env.MERMAIL_PAYMENT_TOKEN;
  const decimalsRaw = process.env.MERMAIL_PAYMENT_DECIMALS;

  if (!chain) {
    throw new Error("MERMAIL_PAYMENT_CHAIN is required");
  }

  if (!credentialId) {
    throw new Error("MERMAIL_PAYMENT_CREDENTIAL_ID is required");
  }

  if (decimalsRaw === undefined) {
    throw new Error("MERMAIL_PAYMENT_DECIMALS is required");
  }

  const decimals = Number(decimalsRaw);

  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error("MERMAIL_PAYMENT_DECIMALS must be a non-negative integer");
  }

  return {
    chain,
    credentialId,
    token: token || null,
    decimals,
  };
}

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

  if (workflow.status !== "APPROVED") {
    return NextResponse.json(
      {
        error: "Payment execution requires APPROVED workflow",
        status: workflow.status,
      },
      { status: 409 },
    );
  }

  const sessionId = request.cookies.get("mermail_oauth_session")?.value;

  if (!sessionId) {
    return NextResponse.json(
      {
        error: "Mermail OAuth session is required for PayBox execution",
      },
      { status: 401 },
    );
  }

  const executionStarted = beginExecution(workflow);

  if (!executionStarted.ok) {
    return NextResponse.json(
      { error: executionStarted.error },
      { status: 409 },
    );
  }

  saveWorkflow(executionStarted.workflow);

  // Log audit event
  auditStore.createEvent(
    "workflow_executed",
    executionStarted.workflow.id,
    {
      recipient: executionStarted.workflow.request.recipient,
      amount: executionStarted.workflow.request.amount,
      currency: executionStarted.workflow.request.currency,
    },
  );

  try {
    const paymentConfig = getPaymentConfig();

    const paymentExecutor = new MermailPaymentExecutor(sessionId);

    // Log audit event for payment initiation
    auditStore.createEvent(
      "payment_initiated",
      executionStarted.workflow.id,
      {
        recipient: executionStarted.workflow.request.recipient,
        amount: executionStarted.workflow.request.amount,
        currency: executionStarted.workflow.request.currency,
        chain: paymentConfig.chain,
      },
    );

    const result = await paymentExecutor.execute({
      workflowId: executionStarted.workflow.id,
      recipient: executionStarted.workflow.request.recipient ?? "",
      amount: executionStarted.workflow.request.amount,
      currency: executionStarted.workflow.request.currency,
      purpose: executionStarted.workflow.request.purpose,
      chain: paymentConfig.chain,
      credentialId: paymentConfig.credentialId,
      token: paymentConfig.token,
      decimals: paymentConfig.decimals,
    });

    if (result.status === "PENDING") {
      const pendingWorkflow = saveWorkflow({
        ...executionStarted.workflow,
        executionId: result.executionId,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        workflow: pendingWorkflow,
        payment: result,
        status: "PENDING",
      });
    }

    if (result.status === "FAILED") {
      const failed = failExecution(
        executionStarted.workflow,
        `Payment execution failed with PayBox status: ${(result.metadata as any)?.payboxStatus || "unknown"}`,
      );

      saveWorkflow(failed.workflow);

      // Log audit event for payment failure
      auditStore.createEvent(
        "payment_failed",
        failed.workflow.id,
        {
          reason: failed.workflow.failureReason,
          executionId: result.executionId,
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
        payment: result,
        status: "FAILED",
      });
    }

    if (result.status === "UNKNOWN") {
      const metadata = result.metadata as
        | {
            submissionUnknown?: boolean;
            invocationId?: string;
            payboxCode?: string;
            payboxError?: string;
          }
        | undefined;

      if (metadata?.submissionUnknown) {
        const unknown = markSubmissionUnknown(
          executionStarted.workflow,
          "PayBox submission outcome is unknown. Reconciliation is required before any retry.",
        );

        if (!unknown.ok) {
          return NextResponse.json(
            { error: unknown.error },
            { status: 500 },
          );
        }

        const unknownWorkflow = saveWorkflow({
          ...unknown.workflow,
          executionId: metadata.invocationId ?? undefined,
          updatedAt: new Date().toISOString(),
        });

        auditStore.createEvent(
          "payment_submission_unknown",
          unknownWorkflow.id,
          {
            invocationId: metadata.invocationId,
            provider: result.provider,
            reason: metadata.payboxError,
            code: metadata.payboxCode,
          },
        );

        return NextResponse.json({
          workflow: unknownWorkflow,
          payment: result,
          status: "SUBMISSION_UNKNOWN",
          reconciliationRequired: true,
        });
      }

      const pendingWorkflow = saveWorkflow({
        ...executionStarted.workflow,
        executionId: result.executionId,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        workflow: pendingWorkflow,
        payment: result,
        status: "PENDING",
      });
    }

    const completed = completeExecution(
      executionStarted.workflow,
      result.executionId,
    );

    if (!completed.ok) {
      return NextResponse.json({ error: completed.error }, { status: 500 });
    }

    saveWorkflow(completed.workflow);

    // Log audit event for payment settlement
    auditStore.createEvent(
      "payment_settled",
      completed.workflow.id,
      {
        executionId: result.executionId,
        provider: result.provider,
        amount: executionStarted.workflow.request.amount,
        currency: executionStarted.workflow.request.currency,
      },
    );

    // Log audit event for workflow completion
    auditStore.createEvent(
      "workflow_completed",
      completed.workflow.id,
      {
        executionId: result.executionId,
      },
    );

    return NextResponse.json({
      workflow: completed.workflow,
      payment: result,
      status: "COMPLETED",
    });
  } catch (error) {
    const failed = failExecution(
      executionStarted.workflow,
      error instanceof Error ? error.message : "Payment execution failed",
    );

    saveWorkflow(failed.workflow);

    // Log audit event for payment failure
    auditStore.createEvent(
      "payment_failed",
      failed.workflow.id,
      {
        reason: failed.workflow.failureReason,
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

    return NextResponse.json(
      {
        error: failed.workflow.failureReason,
        workflow: failed.workflow,
      },
      { status: 502 },
    );
  }
}
