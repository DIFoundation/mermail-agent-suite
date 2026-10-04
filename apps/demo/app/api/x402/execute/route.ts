import { NextRequest, NextResponse } from "next/server";
import { X402Executor, type X402PaymentRequest } from "../../../../lib/x402-executor";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get("mermail_oauth_session")?.value;

  if (!sessionId) {
    return NextResponse.json(
      {
        error: "Mermail OAuth session is required for x402 execution",
      },
      { status: 401 },
    );
  }

  try {
    const body: X402PaymentRequest = await request.json();

    if (!body.url) {
      return NextResponse.json(
        { error: "URL is required for x402 payment" },
        { status: 400 },
      );
    }

    const executor = new X402Executor(sessionId);

    const result = await executor.execute(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      response: result.response,
      paymentId: result.paymentId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "x402 execution failed",
      },
      { status: 500 },
    );
  }
}
