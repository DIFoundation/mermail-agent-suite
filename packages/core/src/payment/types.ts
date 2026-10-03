export interface PaymentExecutionRequest {
  workflowId: string;
  recipient: string;
  amount: string;
  currency: string;
  purpose: string;
}

export interface PaymentExecutionResult {
  executionId: string;
  status: "SUBMITTED" | "SETTLED";
  provider: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentExecutor {
  execute(
    request: PaymentExecutionRequest,
  ): Promise<PaymentExecutionResult>;
}
