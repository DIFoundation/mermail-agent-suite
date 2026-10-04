import type {
  InboxProvider,
  MermailMessage,
} from "@mermail-agent-suite/core";

import { normalizeMermailMessage } from "@mermail-agent-suite/core";
import { connectToMermail } from "./mcp";

type McpToolResult = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  structuredContent?: unknown;
  isError?: boolean;
};

function extractStructuredResult(result: unknown): unknown {
  const toolResult = result as McpToolResult;

  if (toolResult.isError) {
    throw new Error("Mermail MCP tool call failed");
  }

  if (toolResult.structuredContent !== undefined) {
    return toolResult.structuredContent;
  }

  const textContent = toolResult.content?.find(
    (item) => item.type === "text" && typeof item.text === "string",
  );

  if (!textContent?.text) {
    return result;
  }

  try {
    return JSON.parse(textContent.text);
  } catch {
    return textContent.text;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return {};
}

function extractArray(
  value: unknown,
  keys: string[],
): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const record = asRecord(value);

  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key];
    }
  }

  return [];
}

function extractNextCursor(value: unknown): string | undefined {
  const record = asRecord(value);

  const candidates = [
    record.nextCursor,
    record.next_cursor,
    record.cursor,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate) {
      return candidate;
    }
  }

  return undefined;
}

function extractMailboxes(value: unknown): unknown[] {
  return extractArray(value, [
    "mailboxes",
    "items",
    "data",
    "results",
  ]);
}

function extractEmails(value: unknown): unknown[] {
  return extractArray(value, [
    "emails",
    "messages",
    "items",
    "data",
    "results",
  ]);
}

function extractMailboxId(mailbox: unknown): string {
  const record = asRecord(mailbox);

  const id =
    record.public_id ??
    record.publicId ??
    record.mailbox_id ??
    record.mailboxId ??
    record.id ??
    record.email;

  if (typeof id !== "string" || !id) {
    throw new Error("Mermail mailbox response did not contain a usable mailbox id");
  }

  return id;
}

function isUsableMailbox(mailbox: unknown): boolean {
  const record = asRecord(mailbox);

  return (
    record.can_receive === true &&
    record.receiving_status === "ready" &&
    !record.disabled_at
  );
}

function selectMailbox(value: unknown): unknown {
  const mailboxes = extractMailboxes(value);

  const usable = mailboxes.filter(isUsableMailbox);

  if (usable.length === 0) {
    throw new Error(
      "No usable Mermail mailbox found. Expected can_receive=true, receiving_status=ready, disabled_at=null.",
    );
  }

  if (usable.length > 1) {
    throw new Error(
      "Multiple usable Mermail mailboxes found. Configure a specific mailbox with MERMAIL_MAILBOX_ID.",
    );
  }

  return usable[0];
}

async function resolveMailboxId(
  client: Awaited<ReturnType<typeof connectToMermail>>["client"],
): Promise<string> {
  const configuredMailboxId = process.env.MERMAIL_MAILBOX_ID;

  if (configuredMailboxId) {
    return configuredMailboxId;
  }

  const result = await client.callTool({
    name: "list_mailboxes",
    arguments: {
      query: {},
    },
  });

  const payload = extractStructuredResult(result);
  const mailbox = selectMailbox(payload);

  return extractMailboxId(mailbox);
}

async function callMermailTool(
  client: Awaited<ReturnType<typeof connectToMermail>>["client"],
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await client.callTool({
    name,
    arguments: args,
  });

  return extractStructuredResult(result);
}

function normalizeMessages(
  messages: unknown[],
): MermailMessage[] {
  return messages.map((message) =>
    normalizeMermailMessage(message),
  );
}

export const mermailInboxProvider: InboxProvider = {
  async listMessages(options) {
    const { client, transport } = await connectToMermail();

    try {
      const mailboxId = await resolveMailboxId(client);

      const query: Record<string, unknown> = {
        folder: "inbox",
        limit: Math.min(Math.max(options?.limit ?? 20, 1), 100),
        sortColumn: "date",
        sortDirection: "DESC",
        agent_safe_content: true,
      };

      if (options?.unreadOnly !== undefined) {
        query.is_read = !options.unreadOnly;
      }

      if (options?.cursor) {
        query.page = options.cursor;
      }

      const payload = await callMermailTool(
        client,
        "list_emails",
        {
          mailboxId,
          query,
        },
      );

      const messages = extractEmails(payload);

      return {
        messages: normalizeMessages(messages),
        nextCursor: extractNextCursor(payload),
      };
    } finally {
      await transport.terminateSession().catch(() => undefined);
      await client.close();
    }
  },

  async getMessage(id) {
    const { client, transport } = await connectToMermail();

    try {
      const mailboxId = await resolveMailboxId(client);

      const payload = await callMermailTool(
        client,
        "get_email",
        {
          mailboxId,
          emailId: id,
          query: {
            agent_safe_content: true,
            max_body_chars: 12000,
          },
        },
      );

      return normalizeMermailMessage(payload);
    } finally {
      await transport.terminateSession().catch(() => undefined);
      await client.close();
    }
  },

  async searchMessages(query) {
    const { client, transport } = await connectToMermail();

    try {
      const mailboxId = await resolveMailboxId(client);

      const payload = await callMermailTool(
        client,
        "list_emails",
        {
          mailboxId,
          query: {
            folder: "inbox",
            limit: 100,
            sortColumn: "date",
            sortDirection: "DESC",
            agent_safe_content: true,
          },
        },
      );

      const messages = normalizeMessages(
        extractEmails(payload),
      );

      const normalizedQuery = query.toLowerCase();

      return messages.filter((message) =>
        `${message.subject} ${message.body} ${message.from.email}`
          .toLowerCase()
          .includes(normalizedQuery),
      );
    } finally {
      await transport.terminateSession().catch(() => undefined);
      await client.close();
    }
  },
};