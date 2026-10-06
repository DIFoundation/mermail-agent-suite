import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

import {
  createMermailOAuthProvider,
  getMermailMcpUrl,
  hasOAuthSession,
} from "./mermail/oauth";

interface ToolResult {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  structuredContent?: unknown;
  isError?: boolean;
}

function extractToolResult(result: ToolResult): unknown {
  if (result.structuredContent !== undefined) {
    return result.structuredContent;
  }

  const text = result.content?.find(
    (item) =>
      item.type === "text" &&
      typeof item.text === "string" &&
      item.text.length > 0,
  )?.text;

  if (!text) {
    return result;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

export interface X402PaymentRequest {
  url: string | undefined;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  maxAmount?: string;
  paymentNetwork?: string;
  paymentProtocol?: string;
}

export type X402ExecutionStatus = "PROOF_READY" | "PENDING" | "FAILED";

export interface X402PaymentResult {
  status: X402ExecutionStatus;

  /**
   * Provider request id.
   * This is useful for checking pending PayBox state.
   */
  requestId?: string;

  /**
   * Sanitized provider output.
   *
   * Do not persist or expose x_payment/payment credentials.
   */
  response?: unknown;

  /**
   * Only present when the provider explicitly returns
   * a safe payment identifier.
   */
  paymentId?: string;

  error?: string;
}

function getObjectValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return (value as Record<string, unknown>)[key];
}

function getString(value: unknown, key: string): string | undefined {
  const result = getObjectValue(value, key);

  return typeof result === "string" && result.length > 0 ? result : undefined;
}

function classifyX402Result(output: unknown): X402PaymentResult {
  const status = getString(output, "status")?.toLowerCase();

  const requestId =
    getString(output, "request_id") ?? getString(output, "requestId");

  const paymentId =
    getString(output, "payment_id") ?? getString(output, "paymentId");

  /*
   * PayBox success means proof creation, not merchant
   * settlement.
   */
  if (status === "success") {
    return {
      status: "PROOF_READY",
      requestId,
      paymentId,
      response: output,
    };
  }

  const pendingStatuses = new Set([
    "pending_execution",
    "pending_approval",
    "pending_signature",
    "pending_confirmation",
    "pending_settlement",
  ]);

  if (status && pendingStatuses.has(status)) {
    return {
      status: "PENDING",
      requestId,
      response: output,
    };
  }

  if (status === "denied" || status === "error" || status === "failed") {
    return {
      status: "FAILED",
      requestId,
      response: output,
      error: `x402 PayBox request ended with status: ${status}`,
    };
  }

  /*
   * Never interpret an unknown provider state as success.
   */
  return {
    status: "FAILED",
    requestId,
    response: output,
    error: `Unknown x402 PayBox status: ${status ?? "missing"}`,
  };
}

export class X402Executor {
  constructor(private readonly sessionId: string) {}

  async execute(request: X402PaymentRequest): Promise<X402PaymentResult> {
    if (!(await hasOAuthSession(this.sessionId))) {
      throw new Error("Mermail OAuth session is missing or expired.");
    }

    const client = new Client({
      name: "mermail-agent-suite",
      version: "0.1.0",
    });

    const provider = createMermailOAuthProvider(this.sessionId);

    const transport = new StreamableHTTPClientTransport(getMermailMcpUrl(), {
      authProvider: provider,
    });

    try {
      await client.connect(transport);

      const result = await client.callTool({
        name: "paybox_pay_x402",
        arguments: {
          url: request.url,
          method: request.method ?? "GET",
          headers: request.headers ?? {},
          body: request.body,
          maxAmount: request.maxAmount,
          paymentNetwork: request.paymentNetwork,
          paymentProtocol: request.paymentProtocol,
        },
      });

      const output = extractToolResult(result);

      if (result.isError === true) {
        return {
          status: "FAILED",
          error: `x402 PayBox call failed: ${JSON.stringify(output)}`,
        };
      }

      return classifyX402Result(output);
    } catch (error) {
      return {
        status: "FAILED",
        error: error instanceof Error ? error.message : "x402 execution failed",
      };
    } finally {
      await transport.close().catch(() => undefined);

      await client.close().catch(() => undefined);
    }
  }
}
