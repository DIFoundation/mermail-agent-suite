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
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  maxAmount?: string; // Changed from number to string for exact decimal handling
  paymentNetwork?: string;
  paymentProtocol?: string;
}

export interface X402PaymentResult {
  success: boolean;
  response?: unknown;
  paymentId?: string;
  error?: string;
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
          method: request.method || "GET",
          headers: request.headers || {},
          body: request.body,
          maxAmount: request.maxAmount,
          paymentNetwork: request.paymentNetwork,
          paymentProtocol: request.paymentProtocol,
        },
      });

      const output = extractToolResult(result);

      if (result.isError === true) {
        return {
          success: false,
          error: `x402 payment failed: ${JSON.stringify(output)}`,
        };
      }

      return {
        success: true,
        response: output,
        paymentId: (output as any)?.paymentId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "x402 execution failed",
      };
    } finally {
      await transport.close().catch(() => undefined);
      await client.close().catch(() => undefined);
    }
  }
}
