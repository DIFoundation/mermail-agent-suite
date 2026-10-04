export interface MermailMessage {
  id: string;
  threadId?: string;
  from: {
    name?: string;
    email: string;
  };
  to: Array<{
    name?: string;
    email: string;
  }>;
  subject: string;
  body: string;
  receivedAt: string;
  attachments: Array<{
    id?: string;
    filename: string;
    contentType?: string;
    size?: number;
  }>;
}

export interface InboxProvider {
  listMessages(options?: {
    limit?: number;
    cursor?: string;
    unreadOnly?: boolean;
  }): Promise<{
    messages: MermailMessage[];
    nextCursor?: string;
  }>;

  getMessage(id: string): Promise<MermailMessage>;

  searchMessages(query: string, options?: {
    limit?: number;
  }): Promise<MermailMessage[]>;
}
