import { NextRequest, NextResponse } from "next/server";
import {
  auditStore,
  beginX402Execution,
  decimalToAtomicUnits,
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
      {
        error: "This workflow is not an x402 request",
      },
      { status: 400 },
    );
  }

  if (!workflow.request.x402Url) {
    return NextResponse.json(
      {
        error: "x402 URL is required",
      },
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

  const started = beginX402Execution(workflow);

  if (!started.ok) {
    return NextResponse.json({ error: started.error }, { status: 409 });
  }

  saveWorkflow(started.workflow);

  auditStore.createEvent("x402_started", started.workflow.id, {
    url: started.workflow.request.x402Url,
    maxAmount: started.workflow.request.amount,
  });

  try {
    /*
     * Keep exact decimal handling.
     *
     * NOTE:
     * This assumes the selected x402 asset uses
     * 6 decimals. Do not silently generalize this
     * to arbitrary assets.
     */
    const atomicAmount = decimalToAtomicUnits(
      started.workflow.request.amount,
      6,
    );

    const x402Request: X402PaymentRequest = {
      url: started.workflow.request.x402Url,
      method: "POST",
      maxAmount: atomicAmount,
    };

    const executor = new X402Executor(sessionId);

    const result = await executor.execute(x402Request);

    /*
     * PayBox has not produced a usable proof yet.
     */
    if (result.status === "PENDING") {
      const pendingWorkflow = saveWorkflow({
        ...started.workflow,
        executionId: result.requestId,
        updatedAt: new Date().toISOString(),
      });

      auditStore.createEvent("x402_pending", pendingWorkflow.id, {
        requestId: result.requestId,
      });

      return NextResponse.json({
        workflow: pendingWorkflow,
        status: "PENDING",
        requestId: result.requestId,
      });
    }

    /*
     * PayBox failure.
     */
    if (result.status === "FAILED") {
      const failed = failExecution(
        started.workflow,
        result.error ?? "x402 PayBox request failed",
      );

      saveWorkflow(failed.workflow);

      auditStore.createEvent("workflow_failed", failed.workflow.id, {
        reason: failed.workflow.failureReason,
      });

      return NextResponse.json(
        {
          error: failed.workflow.failureReason,
          workflow: failed.workflow,
          status: "FAILED",
        },
        { status: 502 },
      );
    }

    /*
     * IMPORTANT:
     *
     * PROOF_READY is NOT settlement.
     *
     * We intentionally stop here rather than
     * falsely marking the workflow COMPLETED.
     *
     * The exact x402 proof must be redeemed
     * against the frozen endpoint using that
     * endpoint's actual protocol/header contract.
     */
    if (result.status === "PROOF_READY") {
      const proofWorkflow = saveWorkflow({
        ...started.workflow,
        executionId: result.requestId ?? result.paymentId,
        status: "X402_PENDING",
        updatedAt: new Date().toISOString(),
      });

      auditStore.createEvent("x402_proof_ready", proofWorkflow.id, {
        requestId: result.requestId,
        paymentId: result.paymentId,
        url: proofWorkflow.request.x402Url,
      });

      return NextResponse.json({
        workflow: proofWorkflow,
        status: "PROOF_READY",
        requestId: result.requestId,
        message:
          "x402 payment proof is ready. Merchant redemption and settlement are not yet confirmed.",
      });
    }

    /*
     * Defensive fallback.
     */
    const failed = failExecution(
      started.workflow,
      "Unhandled x402 execution state.",
    );

    saveWorkflow(failed.workflow);

    return NextResponse.json(
      {
        error: failed.workflow.failureReason,
        workflow: failed.workflow,
      },
      { status: 502 },
    );
  } catch (error) {
    const failed = failExecution(
      started.workflow,
      error instanceof Error ? error.message : "x402 execution failed",
    );

    saveWorkflow(failed.workflow);

    auditStore.createEvent("workflow_failed", failed.workflow.id, {
      reason: failed.workflow.failureReason,
    });

    return NextResponse.json(
      {
        error: failed.workflow.failureReason,
        workflow: failed.workflow,
      },
      { status: 502 },
    );
  }
}
