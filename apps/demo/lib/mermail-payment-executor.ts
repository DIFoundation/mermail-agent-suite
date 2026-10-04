import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

import {
  decimalToAtomicUnits,
  type PaymentExecutionRequest,
  type PaymentExecutionResult,
  type PaymentExecutor,
} from "@mermail-agent-suite/core";

import {
  createMermailOAuthProvider,
  getMermailMcpUrl,
  hasOAuthSession,
} from "./mermail/oauth";

interface MermailToolResult {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  structuredContent?: unknown;
  isError?: boolean;
}

interface PayBoxRequestResult {
  request_id?: string;
  requestId?: string;
  status?: string;
  [key: string]: unknown;
}

function extractToolResult(result: MermailToolResult): unknown {
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

function getRequestId(result: unknown): string | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  const value = result as PayBoxRequestResult;

  return value.request_id ?? value.requestId;
}

function getStatus(result: unknown): string | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  const value = result as PayBoxRequestResult;

  return value.status;
}

function requireExecutionConfig(request: PaymentExecutionRequest) {
  if (!request.chain) {
    throw new Error("PayBox payment requires an explicit chain.");
  }

  if (!request.credentialId) {
    throw new Error("PayBox payment requires an explicit credentialId.");
  }

  if (request.decimals === undefined) {
    throw new Error("PayBox payment requires explicit token decimals.");
  }
}

export class MermailPaymentExecutor implements PaymentExecutor {
  constructor(private readonly sessionId: string) {}

  async execute(
    request: PaymentExecutionRequest,
  ): Promise<PaymentExecutionResult> {
    if (!(await hasOAuthSession(this.sessionId))) {
      throw new Error("Mermail OAuth session is missing or expired.");
    }

    requireExecutionConfig(request);

    const atomicAmount = decimalToAtomicUnits(
      request.amount,
      request.decimals!,
    );

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
        name: "paybox_request_transfer",
        arguments: {
          amount: atomicAmount,
          chain: request.chain,
          credential_id: request.credentialId,
          to: request.recipient,
          token: request.token ?? null,
        },
      });

      const output = extractToolResult(result);

      if (result.isError === true) {
        throw new Error(
          `Mermail PayBox rejected the transfer request: ${JSON.stringify(output)}`,
        );
      }

      const requestId = getRequestId(output);

      const status = getStatus(output);

      if (!requestId) {
        throw new Error(
          "Mermail PayBox returned no request_id. The transfer state is unknown; do not retry automatically.",
        );
      }

      return {
        executionId: requestId,
        status:
          status === "pending_signature" || status === "pending_approval"
            ? "PENDING"
            : status === "completed" || status === "settled"
              ? "SETTLED"
              : "SUBMITTED",
        provider: "mermail-paybox",
        metadata: {
          mermailRequestId: requestId,
          payboxStatus: status,
          atomicAmount,
          chain: request.chain,
          credentialId: request.credentialId,
          token: request.token ?? null,
        },
      };
    } finally {
      await transport.close().catch(() => undefined);

      await client.close().catch(() => undefined);
    }
  }
}
