import type {
  PaymentExecutionRequest,
  PaymentExecutionResult,
} from "@mermail-agent-suite/core";

import type { PaymentProvider } from "./payment-provider";

export const demoPaymentProvider: PaymentProvider = {
  async execute(
    request: PaymentExecutionRequest,
  ): Promise<PaymentExecutionResult> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    return {
      executionId: `demo-payment-${crypto.randomUUID()}`,
      status: "SETTLED",
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