import { NextRequest, NextResponse } from "next/server";
import {
  auditStore,
  beginX402Execution,
  completeX402Execution,
  continueOriginalRequest,
  failExecution,
} from "@mermail-agent-suite/core";
import { getWorkflow, saveWorkflow } from "../../../../../lib/workflows";
import { X402Executor, type X402PaymentRequest } from "../../../../../lib/x402-executor";

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
        error: "x402 execution requires APPROVED workflow",
        status: workflow.status,
      },
      { status: 409 },
    );
  }

  if (!workflow.request.isX402) {
    return NextResponse.json(
      { error: "This workflow is not an x402 request" },
      { status: 400 },
    );
  }

  if (!workflow.request.x402Url) {
    return NextResponse.json(
      { error: "x402 URL is required" },
      { status: 400 },
    );
  }

  const sessionId = request.cookies.get("mermail_oauth_session")?.value;

  if (!sessionId) {
    return NextResponse.json(
      {
        error: "Mermail OAuth session is required for x402 execution",
      },
      { status: 401 },
    );
  }

  const x402Started = beginX402Execution(workflow);

  if (!x402Started.ok) {
    return NextResponse.json({ error: x402Started.error }, { status: 409 });
  }

  saveWorkflow(x402Started.workflow);

  // Log audit event for x402 start
  auditStore.createEvent(
    "x402_started",
    x402Started.workflow.id,
    {
      url: workflow.request.x402Url,
      maxAmount: workflow.request.amount,
    },
  );

  try {
    const x402Request: X402PaymentRequest = {
      url: workflow.request.x402Url,
      method: "POST",
      maxAmount: parseFloat(workflow.request.amount),
    };

    const executor = new X402Executor(sessionId);

    const result = await executor.execute(x402Request);

    if (!result.success) {
      const failed = failExecution(
        x402Started.workflow,
        result.error || "x402 payment failed",
      );

      saveWorkflow(failed.workflow);

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

    const x402Completed = completeX402Execution(
      x402Started.workflow,
      result.paymentId || "unknown",
    );

    if (!x402Completed.ok) {
      return NextResponse.json({ error: x402Completed.error }, { status: 500 });
    }

    saveWorkflow(x402Completed.workflow);

    // Log audit event for x402 completion
    auditStore.createEvent(
      "x402_completed",
      x402Completed.workflow.id,
      {
        paymentId: result.paymentId,
        url: workflow.request.x402Url,
      },
    );

    // Continue with the original request
    const continued = continueOriginalRequest(x402Completed.workflow, result.response);

    if (!continued.ok) {
      return NextResponse.json({ error: continued.error }, { status: 500 });
    }

    saveWorkflow(continued.workflow);

    // Log audit event for workflow completion
    auditStore.createEvent(
      "workflow_completed",
      continued.workflow.id,
      {
        executionId: continued.workflow.executionId,
      },
    );

    return NextResponse.json({
      workflow: continued.workflow,
      x402Response: result.response,
      paymentId: result.paymentId,
      status: "COMPLETED",
    });
  } catch (error) {
    const failed = failExecution(
      x402Started.workflow,
      error instanceof Error ? error.message : "x402 execution failed",
    );

    saveWorkflow(failed.workflow);

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
