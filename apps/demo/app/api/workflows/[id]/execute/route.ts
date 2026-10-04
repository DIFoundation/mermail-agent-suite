import { NextRequest, NextResponse } from "next/server";
import {
  beginExecution,
  completeExecution,
  failExecution,
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

  try {
    const paymentConfig = getPaymentConfig();

    const paymentExecutor = new MermailPaymentExecutor(sessionId);

    const result = await paymentExecutor.execute({
      workflowId: executionStarted.workflow.id,
      recipient: executionStarted.workflow.request.recipient,
      amount: executionStarted.workflow.request.amount,
      currency: executionStarted.workflow.request.currency,
      purpose: executionStarted.workflow.request.purpose,
      chain: paymentConfig.chain,
      credentialId: paymentConfig.credentialId,
      token: paymentConfig.token,
      decimals: paymentConfig.decimals,
    });

    if (result.status === "PENDING") {
      return NextResponse.json({
        workflow: executionStarted.workflow,
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

    return NextResponse.json(
      {
        error: failed.workflow.failureReason,
        workflow: failed.workflow,
      },
      { status: 502 },
    );
  }
}
