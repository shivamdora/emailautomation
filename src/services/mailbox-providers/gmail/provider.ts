import { google } from "googleapis";
import { randomUUID } from "crypto";
import { env } from "@/lib/supabase/env";
import { normalizeEmailHtmlDocument } from "@/lib/utils/html";
import {
  type MailboxProvider,
  type ProviderTokenState,
  type ReplyDetectionResult,
  type SendMessageInput,
  type SyncResult,
  type SyncThreadsInput,
} from "@/services/mailbox-providers/types";

function createOAuthClient() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth is not configured.");
  }

  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
}

function decodeBody(data?: string | null) {
  if (!data) {
    return null;
  }

  return Buffer.from(data, "base64url").toString("utf8");
}

function buildMimeMessage(input: SendMessageInput) {
  const boundary = `boundary_${randomUUID()}`;
  const encodedText = Buffer.from(input.bodyText, "utf8").toString("base64");
  const encodedHtml = Buffer.from(normalizeEmailHtmlDocument(input.bodyHtml), "utf8").toString("base64");
  const lines = [
    `From: ${input.fromEmail}`,
    `To: ${input.toEmail}`,
    "MIME-Version: 1.0",
    `Subject: ${input.subject}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodedText,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodedHtml,
    "",
    `--${boundary}--`,
  ];

  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export class GmailMailboxProvider implements MailboxProvider {
  async sendMessage(input: SendMessageInput) {
    const auth = createOAuthClient();
    auth.setCredentials({ access_token: input.accessToken });
    const gmail = google.gmail({ version: "v1", auth });
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: buildMimeMessage(input),
        threadId: input.replyThreadId ?? undefined,
      },
    });

    return {
      messageId: response.data.id ?? "",
      threadId: response.data.threadId ?? input.replyThreadId ?? "",
      internalDate: new Date().toISOString(),
    };
  }

  async refreshToken(): Promise<ProviderTokenState> {
    throw new Error("Use gmail-service.refreshMailboxToken() to refresh Gmail tokens.");
  }

  async syncThreads(input: SyncThreadsInput): Promise<SyncResult> {
    const auth = createOAuthClient();
    auth.setCredentials({ access_token: input.accessToken });
    const gmail = google.gmail({ version: "v1", auth });
    const listResponse = await gmail.users.threads.list({
      userId: "me",
      q: "newer_than:7d",
      maxResults: 20,
    });

    const threads = await Promise.all(
      (listResponse.data.threads ?? []).map(async (thread) => {
        const detail = await gmail.users.threads.get({
          userId: "me",
          id: thread.id ?? undefined,
          format: "full",
        });

        return {
          providerThreadId: detail.data.id ?? "",
          messages: (detail.data.messages ?? []).map((message) => {
            const headers = Object.fromEntries(
              (message.payload?.headers ?? []).map((header) => [
                header.name ?? "",
                header.value ?? "",
              ]),
            );
            const fromEmail = headers.From ?? null;
            const toEmails = headers.To ? headers.To.split(",").map((value) => value.trim()) : [];
            const bodyText =
              decodeBody(message.payload?.body?.data) ??
              decodeBody(message.payload?.parts?.find((part) => part.mimeType === "text/plain")?.body?.data);
            const bodyHtml =
              decodeBody(message.payload?.parts?.find((part) => part.mimeType === "text/html")?.body?.data) ??
              decodeBody(message.payload?.body?.data);

            return {
              providerMessageId: message.id ?? "",
              direction: fromEmail?.includes(input.userEmail)
                ? ("outbound" as const)
                : ("inbound" as const),
              fromEmail: fromEmail ?? null,
              toEmails,
              subject: headers.Subject ?? null,
              snippet: message.snippet ?? null,
              bodyText,
              bodyHtml,
              sentAt: new Date(Number(message.internalDate ?? Date.now())).toISOString(),
              headers,
            };
          }),
        };
      }),
    );

    return {
      syncCursor: listResponse.data.resultSizeEstimate?.toString() ?? input.syncCursor ?? null,
      threads,
    };
  }

  async detectReplies(input: SyncResult): Promise<ReplyDetectionResult[]> {
    return input.threads.flatMap((thread) =>
      thread.messages
        .filter((message) => message.direction === "inbound")
        .map((message) => ({
          providerThreadId: thread.providerThreadId,
          providerMessageId: message.providerMessageId,
          sentAt: message.sentAt,
          fromEmail: message.fromEmail,
        })),
    );
  }
}
