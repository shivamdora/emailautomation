import { escapeHtml, normalizeEmailHtmlDocument, stripHtmlToText } from "@/lib/utils/html";
import {
  type MailboxProvider,
  type ProviderTokenState,
  type ReplyDetectionResult,
  type SendMessageInput,
  type SyncResult,
  type SyncThreadsInput,
} from "@/services/mailbox-providers/types";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const IMMUTABLE_ID_PREFERENCE = 'IdType="ImmutableId"';

type GraphMessageRecord = {
  id?: string;
  conversationId?: string;
  subject?: string | null;
  bodyPreview?: string | null;
  body?: { contentType?: string | null; content?: string | null } | null;
  from?: { emailAddress?: { address?: string | null } | null } | null;
  toRecipients?: Array<{ emailAddress?: { address?: string | null } | null }> | null;
  internetMessageHeaders?: Array<{ name?: string | null; value?: string | null }> | null;
  receivedDateTime?: string | null;
  sentDateTime?: string | null;
  isDraft?: boolean | null;
  "@removed"?: Record<string, unknown>;
};

type GraphDeltaResponse = {
  value?: GraphMessageRecord[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};

function buildGraphHeaders(accessToken: string, extra?: Record<string, string>) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    Prefer: IMMUTABLE_ID_PREFERENCE,
    ...extra,
  };
}

async function graphRequest<T>(
  pathOrUrl: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const isAbsolute = /^https?:\/\//i.test(pathOrUrl);
  const response = await fetch(isAbsolute ? pathOrUrl : `${GRAPH_BASE_URL}${pathOrUrl}`, {
    ...init,
    headers: buildGraphHeaders(accessToken, init?.headers as Record<string, string> | undefined),
  });

  if (!response.ok) {
    throw new Error(`Microsoft Graph request failed: ${await response.text()}`);
  }

  if (response.status === 202 || response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

function buildDraftPayload(input: SendMessageInput) {
  return {
    subject: input.subject,
    body: {
      contentType: "HTML",
      content: normalizeEmailHtmlDocument(input.bodyHtml),
    },
    toRecipients: [
      {
        emailAddress: {
          address: input.toEmail,
        },
      },
    ],
  };
}

function buildHtmlFromMessage(message: GraphMessageRecord) {
  const rawContent = message.body?.content ?? null;

  if (!rawContent) {
    return null;
  }

  if ((message.body?.contentType ?? "").toLowerCase() === "html") {
    return normalizeEmailHtmlDocument(rawContent);
  }

  return `<div>${escapeHtml(rawContent).replace(/\n/g, "<br />")}</div>`;
}

async function loadDeltaMessages(accessToken: string, syncCursor?: string | null) {
  let url =
    syncCursor?.trim() ||
    `${GRAPH_BASE_URL}/me/mailFolders/inbox/messages/delta?$select=id,conversationId,subject,body,bodyPreview,from,toRecipients,internetMessageHeaders,receivedDateTime,sentDateTime,isDraft`;
  const records: GraphMessageRecord[] = [];
  let deltaLink: string | null = null;

  while (url) {
    const payload = await graphRequest<GraphDeltaResponse>(url, accessToken);
    records.push(...(payload.value ?? []));
    url = payload["@odata.nextLink"] ?? "";
    deltaLink = payload["@odata.deltaLink"] ?? deltaLink;
  }

  return {
    records,
    deltaLink,
  };
}

export class OutlookMailboxProvider implements MailboxProvider {
  async sendMessage(input: SendMessageInput) {
    if (input.replyMessageId) {
      const replyDraft = await graphRequest<GraphMessageRecord>(
        `/me/messages/${encodeURIComponent(input.replyMessageId)}/createReply`,
        input.accessToken,
        {
          method: "POST",
          headers: {
            "Content-Length": "0",
          },
        },
      );

      await graphRequest<GraphMessageRecord>(
        `/me/messages/${encodeURIComponent(replyDraft.id ?? "")}`,
        input.accessToken,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            body: {
              contentType: "HTML",
              content: normalizeEmailHtmlDocument(input.bodyHtml),
            },
          }),
        },
      );

      await graphRequest<null>(
        `/me/messages/${encodeURIComponent(replyDraft.id ?? "")}/send`,
        input.accessToken,
        {
          method: "POST",
          headers: {
            "Content-Length": "0",
          },
        },
      );

      return {
        messageId: replyDraft.id ?? "",
        threadId: replyDraft.conversationId ?? input.replyThreadId ?? replyDraft.id ?? "",
        internalDate: new Date().toISOString(),
      };
    }

    const draft = await graphRequest<GraphMessageRecord>("/me/messages", input.accessToken, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildDraftPayload(input)),
    });

    await graphRequest<null>(`/me/messages/${encodeURIComponent(draft.id ?? "")}/send`, input.accessToken, {
      method: "POST",
      headers: {
        "Content-Length": "0",
      },
    });

    return {
      messageId: draft.id ?? "",
      threadId: draft.conversationId ?? draft.id ?? "",
      internalDate: new Date().toISOString(),
    };
  }

  async refreshToken(): Promise<ProviderTokenState> {
    throw new Error("Use mailbox-service.refreshMailboxToken() to refresh Microsoft tokens.");
  }

  async syncThreads(input: SyncThreadsInput): Promise<SyncResult> {
    const { records, deltaLink } = await loadDeltaMessages(input.accessToken, input.syncCursor);
    const userEmail = input.userEmail.trim().toLowerCase();
    const grouped = new Map<
      string,
      {
        providerThreadId: string;
        messages: SyncResult["threads"][number]["messages"];
      }
    >();

    for (const message of records) {
      if (message["@removed"] || message.isDraft || !message.id || !message.conversationId) {
        continue;
      }

      const fromEmail = message.from?.emailAddress?.address?.trim() ?? null;
      const toEmails =
        message.toRecipients?.map((recipient) => recipient.emailAddress?.address?.trim() ?? "").filter(Boolean) ??
        [];
      const headers = Object.fromEntries(
        (message.internetMessageHeaders ?? [])
          .filter((header) => header.name && header.value)
          .map((header) => [String(header.name), String(header.value)]),
      );
      const thread = grouped.get(message.conversationId) ?? {
        providerThreadId: message.conversationId,
        messages: [],
      };

      thread.messages.push({
        providerMessageId: message.id,
        direction: fromEmail?.toLowerCase() === userEmail ? "outbound" : "inbound",
        fromEmail,
        toEmails,
        subject: message.subject ?? null,
        snippet: message.bodyPreview ?? null,
        bodyText:
          (message.body?.contentType ?? "").toLowerCase() === "html"
            ? stripHtmlToText(message.body?.content ?? "")
            : message.body?.content ?? message.bodyPreview ?? null,
        bodyHtml: buildHtmlFromMessage(message),
        sentAt: message.receivedDateTime ?? message.sentDateTime ?? new Date().toISOString(),
        headers,
      });

      grouped.set(message.conversationId, thread);
    }

    return {
      syncCursor: deltaLink,
      threads: Array.from(grouped.values()),
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
