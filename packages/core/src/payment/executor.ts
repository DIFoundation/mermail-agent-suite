import type {
  PaymentExecutionRequest,
  PaymentExecutionResult,
  PaymentExecutor,
} from "./types";

export function createPaymentExecutor(
  executor: PaymentExecutor,
): PaymentExecutor {
  return {
    async execute(
      request: PaymentExecutionRequest,
    ): Promise<PaymentExecutionResult> {
      if (!request.workflowId) {
        throw new Error("workflowId is required");
      }

      if (!request.recipient) {
        throw new Error("recipient is required");
      }

      if (!request.amount) {
        throw new Error("amount is required");
      }

      if (!request.currency) {
        throw new Error("currency is required");
      }

      if (!request.purpose) {
        throw new Error("purpose is required");
      }

      return executor.execute(request);
    },
  };
}
