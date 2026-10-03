import { describe, expect, it } from "vitest";
import { createPaymentExecutor } from "./executor";

describe("payment executor boundary", () => {
  it("delegates valid payment requests", async () => {
    const executor = createPaymentExecutor({
      async execute(request) {
        return {
          executionId: "execution-123",
          status: "SETTLED",
          provider: "test",
          metadata: {
            workflowId: request.workflowId,
          },
        };
      },
    });

    const result = await executor.execute({
      workflowId: "workflow-123",
      recipient: "merchant@example.com",
      amount: "5.00",
      currency: "USDC",
      purpose: "research service",
    });

    expect(result.executionId).toBe("execution-123");
    expect(result.status).toBe("SETTLED");
  });

  it("rejects missing recipient", async () => {
    const executor = createPaymentExecutor({
      async execute() {
        throw new Error("should not execute");
      },
    });

    await expect(
      executor.execute({
        workflowId: "workflow-123",
        recipient: "",
        amount: "5.00",
        currency: "USDC",
        purpose: "research service",
      }),
    ).rejects.toThrow("recipient is required");
  });
});
