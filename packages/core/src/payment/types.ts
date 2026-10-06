export interface PaymentExecutionRequest {
  workflowId: string;
  recipient: string;
  amount: string;
  currency: string;
  purpose: string;

  /**
   * PayBox execution metadata.
   *
   * `amount` remains human-readable here.
   * The Mermail adapter converts it into the token's smallest units.
   */
  chain?: string;
  credentialId?: string;
  token?: string | null;
  decimals?: number;
}

export interface PaymentExecutionResult {
  executionId: string;
  status: "SUBMITTED" | "PENDING" | "SETTLED" | "FAILED" | "UNKNOWN";
  provider: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentExecutor {
  execute(
    request: PaymentExecutionRequest,
  ): Promise<PaymentExecutionResult>;
}
