export type MailboxProviderKey = "gmail" | "outlook";

export type SendMessageInput = {
  accessToken: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  replyThreadId?: string | null;
  replyMessageId?: string | null;
};

export type ProviderTokenState = {
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiry?: string | null;
};

export type SyncThreadsInput = {
  accessToken: string;
  userEmail: string;
  syncCursor?: string | null;
  recentThreadIds?: string[];
};

export type SyncResult = {
  syncCursor?: string | null;
  threads: Array<{
    providerThreadId: string;
    messages: Array<{
      providerMessageId: string;
      direction: "outbound" | "inbound";
      fromEmail: string | null;
      toEmails: string[];
      subject: string | null;
      snippet: string | null;
      bodyText: string | null;
      bodyHtml: string | null;
      sentAt: string;
      headers: Record<string, string>;
    }>;
  }>;
};

export type ReplyDetectionResult = {
  providerThreadId: string;
  providerMessageId: string;
  sentAt: string;
  fromEmail: string | null;
};

export interface MailboxProvider {
  sendMessage(input: SendMessageInput): Promise<{
    messageId: string;
    threadId: string;
    internalDate: string;
  }>;
  refreshToken(connectionId: string): Promise<ProviderTokenState>;
  syncThreads(input: SyncThreadsInput): Promise<SyncResult>;
  detectReplies(input: SyncResult): Promise<ReplyDetectionResult[]>;
}
