import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isAnyMissingColumnResult,
  isMissingColumnResult,
} from "../../../src/lib/utils/supabase-schema.ts";
import { config } from "../shared/config.ts";
import { enqueueCrmWritebackJobs } from "../shared/crm.ts";
import { gmailGetThread, gmailListThreads } from "../shared/gmail.ts";
import {
  listActiveMailboxAccounts,
  resolveMailboxAccess,
  updateMailboxSyncState,
  type WorkerMailboxRecord,
} from "../shared/mailboxes.ts";
import { outlookSyncInbox } from "../shared/outlook.ts";
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

function assertMailboxMigrationReady(mailbox: WorkerMailboxRecord) {
  if (mailbox.provider === "outlook") {
    throw new Error(
      "Outlook reply sync requires the latest mailbox-account migration. Apply the current Supabase migrations and retry.",
    );
  }
}

async function syncGmailInbox(input: {
  accessToken: string;
  userEmail: string;
  syncCursor?: string | null;
}) {
  const threadList = await gmailListThreads(input.accessToken);
  const threads = [];

  for (const threadSummary of threadList.threads ?? []) {
    const thread = await gmailGetThread(input.accessToken, threadSummary.id);
    const messages = (thread.messages ?? []).map(
      (message: {
        id?: string;
        internalDate?: string;
        snippet?: string | null;
        payload?: {
          body?: { data?: string | null } | null;
          headers?: Array<{ name?: string; value?: string }> | null;
          parts?: Array<{
            mimeType?: string | null;
            body?: { data?: string | null } | null;
          }> | null;
        } | null;
      }) => {
        const headers = Object.fromEntries(
          (message.payload?.headers ?? []).map((header) => [
            header.name ?? "",
            header.value ?? "",
          ]),
        );
        const fromEmail = headers.From ?? null;
        const toEmails = headers.To
          ? String(headers.To)
              .split(",")
              .map((value) => value.trim())
          : [];
        const bodyText =
          decodeBase64Url(message.payload?.body?.data) ??
          decodeBase64Url(
            message.payload?.parts?.find((part) => part.mimeType === "text/plain")?.body?.data,
          );
        const bodyHtml =
          decodeBase64Url(
            message.payload?.parts?.find((part) => part.mimeType === "text/html")?.body?.data,
          ) ?? decodeBase64Url(message.payload?.body?.data);

        return {
          providerMessageId: message.id ?? "",
          direction: fromEmail?.includes(input.userEmail) ? ("outbound" as const) : ("inbound" as const),
          fromEmail,
          toEmails,
          subject: headers.Subject ?? null,
          snippet: message.snippet ?? null,
          bodyText,
          bodyHtml,
          sentAt: new Date(Number(message.internalDate ?? Date.now())).toISOString(),
          headers,
        };
      },
    );

    threads.push({
      providerThreadId: thread.id ?? "",
      messages,
    });
  }

  return {
    syncCursor: String(threadList.resultSizeEstimate ?? input.syncCursor ?? ""),
    threads,
  };
}

async function loadExistingThread(providerThreadId: string) {
  let result = await supabase
    .from("message_threads")
    .select("id, campaign_contact_id, project_id")
    .eq("provider_thread_id", providerThreadId)
    .maybeSingle();

  if (isMissingColumnResult(result, "message_threads", "provider_thread_id")) {
    result = await supabase
      .from("message_threads")
      .select("id, campaign_contact_id, project_id")
      .eq("gmail_thread_id", providerThreadId)
      .maybeSingle();
  }

  if (result.error) {
    throw result.error;
  }

  return result.data as { id: string; campaign_contact_id?: string | null; project_id?: string | null } | null;
}

async function hasStoredThreadMessage(providerMessageId: string) {
  let result = await supabase
    .from("thread_messages")
    .select("id")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (isMissingColumnResult(result, "thread_messages", "provider_message_id")) {
    result = await supabase
      .from("thread_messages")
      .select("id")
      .eq("gmail_message_id", providerMessageId)
      .maybeSingle();
  }

  if (result.error) {
    throw result.error;
  }

  return Boolean(result.data);
}

async function applyInboundReplyState(input: {
  mailbox: WorkerMailboxRecord;
  campaignContactId: string;
  providerMessageId: string;
  sentAt: string;
  disposition: string;
  fromEmail: string | null;
  subject: string | null;
}) {
  const { data: rawCampaignContact } = await supabase
    .from("campaign_contacts")
    .select("contact_id")
    .eq("id", input.campaignContactId)
    .maybeSingle();
  const campaignContact = rawCampaignContact as { contact_id?: string | null } | null;
  const eventType =
    input.disposition === "negative"
      ? "unsubscribed"
      : input.disposition === "booked"
        ? "meeting_booked"
        : "replied";

  await supabase
    .from("campaign_contacts")
    .update({
      status: eventType === "unsubscribed" ? "unsubscribed" : eventType === "meeting_booked" ? "meeting_booked" : "replied",
      replied_at: input.sentAt,
      reply_disposition: input.disposition,
      meeting_booked_at: input.disposition === "booked" ? input.sentAt : null,
      exit_reason:
        input.disposition === "negative"
          ? "negative_reply"
          : input.disposition === "booked"
            ? "meeting_booked"
            : "reply_received",
      next_due_at: null,
    })
    .eq("id", input.campaignContactId);

  await supabase
    .from("campaign_send_jobs")
    .update({
      status:
        eventType === "meeting_booked" || eventType === "unsubscribed" || eventType === "replied"
          ? "canceled"
          : "canceled",
      canceled_at: input.sentAt,
      processed_at: input.sentAt,
      last_error:
        input.disposition === "negative"
          ? "Negative reply received"
          : input.disposition === "booked"
            ? "Meeting booked"
            : "Reply received",
      reservation_token: null,
    })
    .eq("campaign_contact_id", input.campaignContactId)
    .in("status", ["pending", "reserved"]);

  if (input.disposition === "negative" && campaignContact?.contact_id) {
    await supabase
      .from("contacts")
      .update({ unsubscribed_at: input.sentAt })
      .eq("id", campaignContact.contact_id);
  }

  let messageEventResult = await supabase.from("message_events").insert({
    workspace_id: input.mailbox.workspace_id,
    campaign_contact_id: input.campaignContactId,
    gmail_message_id: input.providerMessageId,
    provider_message_id: input.providerMessageId,
    event_type: eventType,
    metadata: {
      disposition: input.disposition,
      fromEmail: input.fromEmail,
      subject: input.subject,
      provider: input.mailbox.provider,
    },
  });

  if (isMissingColumnResult(messageEventResult, "message_events", "provider_message_id")) {
    assertMailboxMigrationReady(input.mailbox);
    messageEventResult = await supabase.from("message_events").insert({
      workspace_id: input.mailbox.workspace_id,
      campaign_contact_id: input.campaignContactId,
      gmail_message_id: input.providerMessageId,
      event_type: eventType,
      metadata: {
        disposition: input.disposition,
        fromEmail: input.fromEmail,
        subject: input.subject,
        provider: input.mailbox.provider,
      },
    });
  }

  if (messageEventResult.error) {
    throw messageEventResult.error;
  }

  await enqueueCrmWritebackJobs({
    supabase,
    workspaceId: input.mailbox.workspace_id,
    campaignContactId: input.campaignContactId,
    eventType,
    metadata: {
      disposition: input.disposition,
      subject: input.subject,
      fromEmail: input.fromEmail,
      provider: input.mailbox.provider,
    },
  });
}

Deno.serve(async (request) => {
  if (!verifyCron(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  let mailboxes: WorkerMailboxRecord[] = [];

  try {
    mailboxes = await listActiveMailboxAccounts(supabase);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Failed to load active mailboxes." },
      { status: 500 },
    );
  }

  let syncedThreads = 0;
  let inboundMessages = 0;
  let mailboxErrors = 0;

  for (const mailbox of mailboxes) {
    if (mailbox.approval_status && mailbox.approval_status !== "approved") {
      continue;
    }

    try {
      const accessToken = await resolveMailboxAccess(supabase, mailbox);
      const syncResult =
        mailbox.provider === "outlook"
          ? await outlookSyncInbox({
              accessToken,
              userEmail: mailbox.email_address,
              syncCursor: mailbox.last_sync_cursor ?? undefined,
            })
          : await syncGmailInbox({
              accessToken,
              userEmail: mailbox.email_address,
              syncCursor: mailbox.last_sync_cursor ?? undefined,
            });
      const syncedAt = new Date().toISOString();

      for (const thread of syncResult.threads) {
        const latestMessage = [...thread.messages].sort(
          (left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime(),
        )[0];
        const existingThread = await loadExistingThread(thread.providerThreadId);
        let threadUpsertResult = await supabase
          .from("message_threads")
          .upsert(
            {
              workspace_id: mailbox.workspace_id,
              project_id: existingThread?.project_id ?? mailbox.project_id,
              campaign_contact_id: existingThread?.campaign_contact_id ?? null,
              mailbox_account_id: mailbox.id,
              provider_thread_id: thread.providerThreadId,
              gmail_thread_id: thread.providerThreadId,
              subject: latestMessage?.subject ?? null,
              snippet:
                latestMessage?.snippet ??
                latestMessage?.bodyText?.slice(0, 120) ??
                latestMessage?.subject ??
                null,
              latest_message_at: latestMessage?.sentAt ?? syncedAt,
            },
            { onConflict: "mailbox_account_id,provider_thread_id" },
          )
          .select("id, campaign_contact_id")
          .single();

        if (
          isAnyMissingColumnResult(threadUpsertResult, [
            { table: "message_threads", column: "mailbox_account_id" },
            { table: "message_threads", column: "provider_thread_id" },
          ])
        ) {
          assertMailboxMigrationReady(mailbox);
          threadUpsertResult = await supabase
            .from("message_threads")
            .upsert({
              workspace_id: mailbox.workspace_id,
              project_id: existingThread?.project_id ?? mailbox.project_id,
              campaign_contact_id: existingThread?.campaign_contact_id ?? null,
              gmail_thread_id: thread.providerThreadId,
              subject: latestMessage?.subject ?? null,
              snippet:
                latestMessage?.snippet ??
                latestMessage?.bodyText?.slice(0, 120) ??
                latestMessage?.subject ??
                null,
              latest_message_at: latestMessage?.sentAt ?? syncedAt,
            })
            .select("id, campaign_contact_id")
            .single();
        }

        if (threadUpsertResult.error) {
          throw threadUpsertResult.error;
        }

        const storedThread = threadUpsertResult.data as {
          id: string;
          campaign_contact_id?: string | null;
        };

        for (const message of thread.messages) {
          const alreadyStored = await hasStoredThreadMessage(message.providerMessageId);

          let threadMessageResult = await supabase.from("thread_messages").upsert(
            {
              gmail_thread_id: thread.providerThreadId,
              gmail_message_id: message.providerMessageId,
              provider_message_id: message.providerMessageId,
              direction: message.direction,
              from_email: message.fromEmail,
              to_emails: message.toEmails,
              subject: message.subject,
              snippet: message.snippet,
              body_text: message.bodyText,
              body_html: message.bodyHtml,
              headers_jsonb: message.headers,
              sent_at: message.sentAt,
            },
            { onConflict: "provider_message_id" },
          );

          if (isMissingColumnResult(threadMessageResult, "thread_messages", "provider_message_id")) {
            assertMailboxMigrationReady(mailbox);
            threadMessageResult = await supabase.from("thread_messages").upsert({
              gmail_thread_id: thread.providerThreadId,
              gmail_message_id: message.providerMessageId,
              direction: message.direction,
              from_email: message.fromEmail,
              to_emails: message.toEmails,
              subject: message.subject,
              snippet: message.snippet,
              body_text: message.bodyText,
              body_html: message.bodyHtml,
              headers_jsonb: message.headers,
              sent_at: message.sentAt,
            });
          }

          if (threadMessageResult.error) {
            throw threadMessageResult.error;
          }

          if (message.direction === "inbound" && storedThread.campaign_contact_id && !alreadyStored) {
            const disposition = classifyReplyDisposition(
              [message.subject ?? "", message.bodyText ?? "", message.snippet ?? ""]
                .filter(Boolean)
                .join("\n"),
            );

            await applyInboundReplyState({
              mailbox,
              campaignContactId: storedThread.campaign_contact_id,
              providerMessageId: message.providerMessageId,
              sentAt: message.sentAt,
              disposition,
              fromEmail: message.fromEmail,
              subject: message.subject,
            });

            inboundMessages += 1;
          }
        }

        syncedThreads += 1;
      }

      await updateMailboxSyncState(supabase, mailbox, {
        healthStatus: "active",
        syncCursor: syncResult.syncCursor ?? mailbox.last_sync_cursor ?? null,
        syncedAt,
      });
    } catch (error) {
      console.error("Failed to sync mailbox", mailbox.email_address, error);
      await updateMailboxSyncState(supabase, mailbox, {
        healthStatus: "needs_reauth",
        syncedAt: new Date().toISOString(),
      });
      mailboxErrors += 1;
    }
  }

  return json({ synced: syncedThreads, inboundMessages, mailboxErrors });
});
