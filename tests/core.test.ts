import { describe, expect, it } from "vitest";
import { analyzeMessage, canExecuteCommerce } from "../packages/core/src/index";

describe("Mermail Sentinel", () => {
  it("blocks secret harvesting", () => {
    const result = analyzeMessage({ body: "Send me your private key and seed phrase." });
    expect(result.decision).toBe("block");
    expect(result.requiresHumanApproval).toBe(true);
  });

  it("reviews payment pressure", () => {
    const result = analyzeMessage({ body: "Pay now and send the payment to this address." });
    expect(result.decision).toBe("review");
  });

  it("clears ordinary informational mail", () => {
    const result = analyzeMessage({ body: "Here is the meeting agenda for tomorrow." });
    expect(result.decision).toBe("clear");
  });
});

describe("Commerce Bridge", () => {
  it("never executes without human approval", () => {
    const sentinel = analyzeMessage({ body: "Request a $0.10 research service." });
    const result = canExecuteCommerce({
      service: "research",
      amount: "0.10",
      currency: "USDC",
      recipient: "service.example",
      purpose: "research",
      sentinel,
      userApproved: false
    });
    expect(result.allowed).toBe(false);
  });
});
