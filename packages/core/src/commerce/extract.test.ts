import { describe, expect, it } from "vitest";
import { extractCommerceRequest } from "./extract";

describe("extractCommerceRequest", () => {
  it("extracts an explicit USDT payment request", () => {
    const result = extractCommerceRequest({
      subject: "API invoice",
      body:
        "Please pay the outstanding invoice of 25 USDT to 0x1234567890123456789012345678901234567890 for the API service.",
    });

    expect(result.status).toBe("MATCHED");
    expect(result.amount).toBe("25");
    expect(result.currency).toBe("USDT");
    expect(result.recipient).toBe(
      "0x1234567890123456789012345678901234567890",
    );
    expect(result.purpose).toBe("outstanding invoice");
    expect(result.service).toBe("API");
    expect(result.missingFields).toEqual([]);
  });

  it("recognizes non-commerce email", () => {
    const result = extractCommerceRequest({
      subject: "Welcome",
      body: "Welcome to our service. We are happy to have you here.",
    });

    expect(result.status).toBe("NOT_COMMERCE");
    expect(result.missingFields).toEqual([]);
  });

  it("does not invent missing commerce fields", () => {
    const result = extractCommerceRequest({
      subject: "Payment request",
      body: "Please pay the invoice of 25 USDT.",
    });

    expect(result.status).toBe("MATCHED");
    expect(result.amount).toBe("25");
    expect(result.currency).toBe("USDT");
    expect(result.recipient).toBeUndefined();
    expect(result.missingFields).toEqual([]);
    expect(result.missingFields).toEqual([]);
  });

  it("extracts currency before amount", () => {
    const result = extractCommerceRequest({
      subject: "Payment",
      body:
        "Please pay USDT 25 to 0x1234567890123456789012345678901234567890 for the API service.",
    });

    expect(result.status).toBe("MATCHED");
    expect(result.amount).toBe("25");
    expect(result.currency).toBe("USDT");
  });

  it("does not treat an email as authorization", () => {
    const result = extractCommerceRequest({
      subject: "Pay invoice",
      body:
        "Please pay 25 USDT to 0x1234567890123456789012345678901234567890 for the API service.",
    });

    expect(result.status).toBe("MATCHED");

    // Extraction represents what the email requested.
    // Authorization is deliberately outside this extractor.
    expect(result).not.toHaveProperty("userApproved");
  });
});
