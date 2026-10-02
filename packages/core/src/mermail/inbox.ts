import { analyzeMessage } from "../index";
import type { MermailMessage, InboxProvider } from "./types";

export interface InboxMessageWithSecurity extends MermailMessage {
  security: ReturnType<typeof analyzeMessage>;
}

export async function inspectInboxMessage(
  provider: InboxProvider,
  id: string,
): Promise<InboxMessageWithSecurity> {
  const message = await provider.getMessage(id);

  return {
    ...message,
    security: analyzeMessage({
      subject: message.subject,
      body: message.body,
    }),
  };
}

export async function inspectInbox(
  provider: InboxProvider,
  options?: {
    limit?: number;
    cursor?: string;
    unreadOnly?: boolean;
  },
): Promise<{
  messages: InboxMessageWithSecurity[];
  nextCursor?: string;
}> {
  const result = await provider.listMessages(options);

  return {
    messages: result.messages.map((message) => ({
      ...message,
      security: analyzeMessage({
        subject: message.subject,
        body: message.body,
      }),
    })),
    nextCursor: result.nextCursor,
  };
}
