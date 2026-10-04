import type { MermailMessage } from "./types";

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function normalizeAddress(value: unknown): {
  name?: string;
  email: string;
} {
  if (typeof value === "string") {
    const match = value.match(/^(.*?)\s*<([^>]+)>$/);

    if (match) {
      return {
        name: match[1].trim() || undefined,
        email: match[2].trim(),
      };
    }

    return { email: value.trim() };
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    return {
      name:
        text(record.name || record.displayName || record.fullName).trim() ||
        undefined,
      email: text(record.email || record.address).trim(),
    };
  }

  return { email: "" };
}

export function normalizeMermailMessage(raw: unknown): MermailMessage {
  const record = (raw ?? {}) as Record<string, unknown>;

  const sender = record.from ?? record.sender;
  const recipients = record.to ?? record.recipients ?? [];

  const body =
    record.body ??
    record.text ??
    record.textBody ??
    record.plainText ??
    record.content ??
    "";

  const attachments = Array.isArray(record.attachments)
    ? record.attachments
    : [];

  return {
    id: text(record.id || record.messageId),
    threadId: text(record.threadId || record.thread_id) || undefined,

    from: normalizeAddress(sender),

    to: Array.isArray(recipients)
      ? recipients.map(normalizeAddress)
      : [normalizeAddress(recipients)],

    subject: text(record.subject),

    body: text(body),

    receivedAt: text(
      record.receivedAt ||
        record.received_at ||
        record.timestamp ||
        record.date,
    ),

    attachments: attachments.map((attachment) => {
      const item = (attachment ?? {}) as Record<string, unknown>;

      return {
        id: text(item.id || item.attachmentId) || undefined,
        filename: text(
          item.filename ||
            item.fileName ||
            item.name ||
            "unknown-attachment",
        ),
        contentType:
          text(item.contentType || item.mimeType) || undefined,
        size:
          typeof item.size === "number"
            ? item.size
            : undefined,
      };
    }),
  };
}

export function normalizeMermailMessages(raw: unknown): MermailMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw.map(normalizeMermailMessage);
}
