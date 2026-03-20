import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { config } from "../shared/config.ts";
import { enqueueCrmWritebackJobs } from "../shared/crm.ts";
import { decryptToken, encryptToken } from "../shared/crypto.ts";
import { gmailGetThread, gmailListThreads, gmailRefreshAccessToken } from "../shared/gmail.ts";
import { json } from "../shared/response.ts";

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);

function verifyCron(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  return config.cronVerifySecret ? secret === config.cronVerifySecret : true;
}

function decodeBase64Url(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(normalized);
}

function classifyReplyDisposition(content: string) {
  const normalized = content.toLowerCase();

  if (/\b(stop|unsubscribe|remove me|do not contact|don't contact|opt out)\b/.test(normalized)) {
    return "negative";
  }

  if (/\b(booked|calendar invite|meeting confirmed|scheduled|lets meet|let's meet)\b/.test(normalized)) {
    return "booked";
  }

  if (/\b(interested|sounds good|yes|let's talk|lets talk|available)\b/.test(normalized)) {
    return "positive";
  }

  if (/\?/.test(normalized) || /\b(question|more info|details)\b/.test(normalized)) {
    return "question";
  }

  return "other";
}

async function resolveMailboxAccess(mailbox: {
  oauth_connection?: {
    id?: string;
    access_token_encrypted?: string | null;
    refresh_token_encrypted?: string | null;
    token_expiry?: string | null;
  } | null;
}) {
  const oauthConnection = mailbox.oauth_connection;

  if (!oauthConnection) {
    throw new Error("Missing oauth connection.");
  }

  const shouldRefresh =
    !oauthConnection.access_token_encrypted ||
    (oauthConnection.token_expiry &&
      new Date(oauthConnection.token_expiry).getTime() <= Date.now() + 60_000);

  if (!shouldRefresh && oauthConnection.access_token_encrypted) {
    return decryptToken(oauthConnection.access_token_encrypted);
  }

  if (!oauthConnection.refresh_token_encrypted) {
    throw new Error("Missing refresh token.");
  }

  const refreshed = await gmailRefreshAccessToken(
    await decryptToken(oauthConnection.refresh_token_encrypted),
  );

  await supabase
    .from("oauth_connections")
    .update({
      access_token_encrypted: await encryptToken(refreshed.access_token),
      token_expiry: refreshed.expires_in
        ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString()
        : null,
    })
    .eq("id", oauthConnection.id);

  return refreshed.access_token as string;
}

Deno.serve(async (request) => {
  if (!verifyCron(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: mailboxes, error } = await supabase
    .from("gmail_accounts")
    .select("id, workspace_id, email_address, approval_status, last_history_id, oauth_connection:oauth_connections(id, access_token_encrypted, refresh_token_encrypted, token_expiry)")
    .eq("status", "active");

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  let synced = 0;

  for (const mailbox of mailboxes ?? []) {
    if (mailbox.approval_status && mailbox.approval_status !== "approved") {
      continue;
    }

    const accessToken = await resolveMailboxAccess(mailbox);
    const threadList = await gmailListThreads(accessToken);

    for (const threadSummary of threadList.threads ?? []) {
      const thread = await gmailGetThread(accessToken, threadSummary.id);
      const messages = thread.messages ?? [];
      const latestMessageAt = Math.max(
        ...messages.map((message: { internalDate?: string }) => Number(message.internalDate ?? Date.now())),
      );
      const { data: existingThread } = await supabase
        .from("message_threads")
        .select("id, campaign_contact_id")
        .eq("gmail_thread_id", thread.id)
        .maybeSingle();

      await supabase.from("message_threads").upsert({
        workspace_id: mailbox.workspace_id,
        gmail_thread_id: thread.id,
        campaign_contact_id: existingThread?.campaign_contact_id ?? null,
        subject:
          messages[0]?.payload?.headers?.find((header: { name?: string }) => header.name === "Subject")?.value ??
          null,
        snippet: thread.snippet ?? null,
        latest_message_at: new Date(latestMessageAt).toISOString(),
      });

      for (const message of messages) {
        const headers = Object.fromEntries(
          (message.payload?.headers ?? []).map((header: { name?: string; value?: string }) => [
            header.name ?? "",
            header.value ?? "",
          ]),
        );
        const fromEmail = headers.From ?? null;
        const toEmails = headers.To ? headers.To.split(",").map((value: string) => value.trim()) : [];
        const direction = fromEmail?.includes(mailbox.email_address) ? "outbound" : "inbound";
        const bodyText =
          decodeBase64Url(message.payload?.body?.data) ??
          decodeBase64Url(message.payload?.parts?.find((part: { mimeType?: string }) => part.mimeType === "text/plain")?.body?.data);

        await supabase.from("thread_messages").upsert({
          gmail_thread_id: thread.id,
          gmail_message_id: message.id,
          direction,
          from_email: fromEmail,
          to_emails: toEmails,
          subject: headers.Subject ?? null,
          snippet: message.snippet ?? null,
          body_text: bodyText,
          body_html: null,
          headers_jsonb: headers,
          sent_at: new Date(Number(message.internalDate ?? Date.now())).toISOString(),
        });

        if (direction === "inbound") {
          const { data: threadRecord } = await supabase
            .from("message_threads")
            .select("campaign_contact_id")
            .eq("gmail_thread_id", thread.id)
            .maybeSingle();

          if (threadRecord?.campaign_contact_id) {
            const sentAt = new Date(Number(message.internalDate ?? Date.now())).toISOString();
            const disposition = classifyReplyDisposition(
              [headers.Subject ?? "", bodyText ?? "", message.snippet ?? ""].filter(Boolean).join("\n"),
            );
            const nextStatus =
              disposition === "negative"
                ? "unsubscribed"
                : disposition === "booked"
                  ? "meeting_booked"
                  : "replied";
            await supabase
              .from("campaign_contacts")
              .update({
                status: nextStatus,
                replied_at: sentAt,
                reply_disposition: disposition,
                meeting_booked_at: disposition === "booked" ? sentAt : null,
                exit_reason:
                  disposition === "negative"
                    ? "negative_reply"
                    : disposition === "booked"
                      ? "meeting_booked"
                      : "reply_received",
                next_due_at: null,
              })
              .eq("id", threadRecord.campaign_contact_id);

            await supabase.from("message_events").insert({
              workspace_id: mailbox.workspace_id,
              campaign_contact_id: threadRecord.campaign_contact_id,
              gmail_message_id: message.id,
              event_type:
                disposition === "negative"
                  ? "unsubscribed"
                  : disposition === "booked"
                    ? "meeting_booked"
                    : "replied",
              metadata: {
                disposition,
                fromEmail,
                subject: headers.Subject ?? null,
              },
            });
            await enqueueCrmWritebackJobs({
              supabase,
              workspaceId: mailbox.workspace_id,
              campaignContactId: threadRecord.campaign_contact_id,
              eventType:
                disposition === "negative"
                  ? "unsubscribed"
                  : disposition === "booked"
                    ? "meeting_booked"
                    : "replied",
              metadata: {
                disposition,
                subject: headers.Subject ?? null,
                fromEmail,
              },
            });
          }
        }
      }

      synced += 1;
    }

    await supabase
      .from("gmail_accounts")
      .update({
        last_history_id: String(threadList.resultSizeEstimate ?? mailbox.last_history_id ?? ""),
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", mailbox.id);
  }

  return json({ synced });
});
