import { NextResponse } from "next/server";
import {
  beginExecution,
  completeExecution,
  failExecution,
} from "@mermail-agent-suite/core";
import { getWorkflow, saveWorkflow } from "../../../../../lib/workflows";
import { createAppPaymentExecutor } from "../../../../../lib/payment-executor";
import { demoPaymentProvider } from "../../../../../lib/demo-payment-provider";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const workflow = getWorkflow(id);

  if (!workflow) {
    return NextResponse.json(
      { error: "Workflow not found" },
      { status: 404 },
    );
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

  const executionStarted = beginExecution(workflow);

  if (!executionStarted.ok) {
    return NextResponse.json(
      { error: executionStarted.error },
      { status: 409 },
    );
  }

  saveWorkflow(executionStarted.workflow);

  const paymentExecutor = createAppPaymentExecutor(demoPaymentProvider);

  try {
    const result = await paymentExecutor.execute({
      workflowId: executionStarted.workflow.id,
      recipient: executionStarted.workflow.request.recipient,
      amount: executionStarted.workflow.request.amount,
      currency: executionStarted.workflow.request.currency,
      purpose: executionStarted.workflow.request.purpose,
    });

    const completed = completeExecution(
      executionStarted.workflow,
      result.executionId,
    );

    if (!completed.ok) {
      return NextResponse.json(
        { error: completed.error },
        { status: 500 },
      );
    }

    saveWorkflow(completed.workflow);

    return NextResponse.json({
      workflow: completed.workflow,
      payment: result,
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
