import {
  escapeHtml,
  normalizeEmailHtmlDocument,
  stripHtmlToText,
} from "../../../src/lib/utils/html.ts";
import { config } from "./config.ts";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const IMMUTABLE_ID_PREFERENCE = 'IdType="ImmutableId"';
const MICROSOFT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Mail.Send",
  "Mail.ReadWrite",
];

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

type OutlookSendInput = {
  accessToken: string;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  replyMessageId?: string | null;
  replyThreadId?: string | null;
};

function getMicrosoftAuthorityBaseUrl() {
  const tenant = config.microsoftTenantId.trim() || "common";
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;
}

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
  const response = await fetch(
    /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${GRAPH_BASE_URL}${pathOrUrl}`,
    {
      ...init,
      headers: buildGraphHeaders(
        accessToken,
        init?.headers as Record<string, string> | undefined,
      ),
    },
  );

  if (!response.ok) {
    throw new Error(`Microsoft Graph request failed: ${await response.text()}`);
  }

  if (response.status === 202 || response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

function buildDraftPayload(input: OutlookSendInput) {
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

export async function microsoftRefreshAccessToken(refreshToken: string) {
  if (!config.microsoftClientId || !config.microsoftClientSecret) {
    throw new Error("Microsoft OAuth is not configured.");
  }

  const response = await fetch(`${getMicrosoftAuthorityBaseUrl()}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.microsoftClientId,
      client_secret: config.microsoftClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: MICROSOFT_SCOPES.join(" "),
    }),
  });

  if (!response.ok) {
    throw new Error(`Microsoft token refresh failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
}

export async function outlookSend(input: OutlookSendInput) {
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
      id: replyDraft.id ?? "",
      threadId: replyDraft.conversationId ?? input.replyThreadId ?? replyDraft.id ?? "",
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
    id: draft.id ?? "",
    threadId: draft.conversationId ?? draft.id ?? "",
  };
}

export async function outlookSyncInbox(input: {
  accessToken: string;
  userEmail: string;
  syncCursor?: string | null;
}) {
  let url =
    input.syncCursor?.trim() ||
    `${GRAPH_BASE_URL}/me/mailFolders/inbox/messages/delta?$select=id,conversationId,subject,body,bodyPreview,from,toRecipients,internetMessageHeaders,receivedDateTime,sentDateTime,isDraft`;
  const records: GraphMessageRecord[] = [];
  let deltaLink: string | null = input.syncCursor?.trim() || null;

  while (url) {
    const payload = await graphRequest<GraphDeltaResponse>(url, input.accessToken);
    records.push(...(payload.value ?? []));
    url = payload["@odata.nextLink"] ?? "";
    deltaLink = payload["@odata.deltaLink"] ?? deltaLink;
  }

  const userEmail = input.userEmail.trim().toLowerCase();
  const grouped = new Map<
    string,
    {
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
    }
  >();

  for (const message of records) {
    if (message["@removed"] || message.isDraft || !message.id || !message.conversationId) {
      continue;
    }

    const fromEmail = message.from?.emailAddress?.address?.trim() ?? null;
    const toEmails =
      message.toRecipients
        ?.map((recipient) => recipient.emailAddress?.address?.trim() ?? "")
        .filter(Boolean) ?? [];
    const headers = Object.fromEntries(
      (message.internetMessageHeaders ?? [])
        .filter((header) => header.name && header.value)
        .map((header) => [String(header.name), String(header.value)]),
    );
    const thread = grouped.get(message.conversationId) ?? {
      providerThreadId: message.conversationId,
      messages: [],
    };
    const bodyHtml = buildHtmlFromMessage(message);

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
      bodyHtml,
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
