import type {
  PaymentExecutionRequest,
  PaymentExecutionResult,
  PaymentExecutor,
} from "@mermail-agent-suite/core";

export const demoPaymentExecutor: PaymentExecutor = {
  async execute(
    request: PaymentExecutionRequest,
  ): Promise<PaymentExecutionResult> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    return {
      executionId: `demo-payment-${crypto.randomUUID()}`,
      status: "settled",
      provider: "demo-executor",
      metadata: {
        workflowId: request.workflowId,
        recipient: request.recipient,
        amount: request.amount,
        currency: request.currency,
        purpose: request.purpose,
        simulated: true,
      },
    };
  },
};
