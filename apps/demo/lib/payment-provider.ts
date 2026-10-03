import type {
  PaymentExecutionRequest,
  PaymentExecutionResult,
} from "@mermail-agent-suite/core";

export interface PaymentProvider {
  execute(
    request: PaymentExecutionRequest,
  ): Promise<PaymentExecutionResult>;
}
