import "server-only";
import { google } from "googleapis";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { classifyReplyDisposition } from "@/lib/utils/reply-disposition";
import { isAnyMissingColumnResult, isMissingColumnError, isMissingColumnResult } from "@/lib/utils/supabase-schema";
import {
  env,
  isGoogleConfigured,
  requireGoogleConfiguration,
  requireSupabaseConfiguration,
} from "@/lib/supabase/env";
import { cancelPendingCampaignJobs } from "@/services/campaign-send-queue-service";
import { assertWorkspaceCanConnectMailbox, refreshWorkspaceUsageCounters } from "@/services/entitlement-service";
import { getMailboxProvider } from "@/services/mailbox-providers";
import { recordMessageEvent } from "@/services/telemetry-service";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

function createOAuthClient() {
  requireGoogleConfiguration();

  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_OAUTH_REDIRECT_URI,
  );
}

function createOAuthClientWithRedirectUri(redirectUri?: string) {
  requireGoogleConfiguration();

  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    redirectUri ?? env.GOOGLE_OAUTH_REDIRECT_URI,
  );
}

async function updateCampaignContactReplyState(
  campaignContactId: string,
  values: Record<string, unknown>,
) {
  const supabase = createAdminSupabaseClient();
  let result = await supabase
    .from("campaign_contacts")
    .update(values)
    .eq("id", campaignContactId);

  if (
    isAnyMissingColumnResult(result, [
      { table: "campaign_contacts", column: "reply_disposition" },
      { table: "campaign_contacts", column: "meeting_booked_at" },
      { table: "campaign_contacts", column: "exit_reason" },
    ])
  ) {
    const fallbackValues = { ...values };
    delete fallbackValues.reply_disposition;
    delete fallbackValues.meeting_booked_at;
    delete fallbackValues.exit_reason;

    result = await supabase
      .from("campaign_contacts")
      .update(fallbackValues)
      .eq("id", campaignContactId);
  }

  if (result.error) {
    throw result.error;
  }
}

export function createGoogleConnectUrl(
  state: string,
  options?: { redirectUri?: string; scopes?: string[] },
) {
  requireGoogleConfiguration();
  const auth = createOAuthClientWithRedirectUri(options?.redirectUri);
  return auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: options?.scopes?.length ? options.scopes : GMAIL_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeGoogleCode(code: string, options?: { redirectUri?: string }) {
  const auth = createOAuthClientWithRedirectUri(options?.redirectUri);
  const { tokens } = await auth.getToken(code);

  if (!tokens.access_token) {
    throw new Error("Google OAuth exchange did not return an access token.");
  }

  auth.setCredentials(tokens);
  const gmail = google.gmail({ auth, version: "v1" });
  const { data } = await gmail.users.getProfile({ userId: "me" });

  if (!data.emailAddress) {
    throw new Error("Google OAuth exchange did not return a mailbox email address.");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    emailAddress: data.emailAddress,
    scopes: GMAIL_SCOPES,
  };
}

export async function storeGmailConnection(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  emailAddress: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiry: string | null;
  scopes: string[];
}) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data: rawOauthConnection, error } = await supabase
    .from("oauth_connections")
    .upsert(
      {
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        user_id: input.userId,
        provider: "gmail",
        email_address: input.emailAddress,
        access_token_encrypted: encryptToken(input.accessToken),
        refresh_token_encrypted: input.refreshToken ? encryptToken(input.refreshToken) : null,
        token_expiry: input.tokenExpiry,
        scopes: input.scopes,
        status: "active",
      },
      { onConflict: "project_id,provider,email_address" },
    )
    .select("id")
    .single();

  if (error) {
    throw error;
  }
  const oauthConnection = rawOauthConnection as { id: string };

  let gmailAccountResult = await supabase
    .from("gmail_accounts")
    .upsert(
      {
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        user_id: input.userId,
        oauth_connection_id: oauthConnection.id,
        email_address: input.emailAddress,
        health_status: "active",
        status: "active",
        approval_status: "pending",
        approved_by_user_id: null,
        approved_at: null,
        approval_note: "Awaiting workspace approval",
        daily_send_count: 0,
      },
      { onConflict: "project_id,email_address" },
    )
    .select("id, email_address, approval_status")
    .single();

  if (isMissingColumnResult(gmailAccountResult, "gmail_accounts", "approval_status")) {
    gmailAccountResult = await supabase
      .from("gmail_accounts")
      .upsert(
        {
          workspace_id: input.workspaceId,
          project_id: input.projectId,
          user_id: input.userId,
          oauth_connection_id: oauthConnection.id,
          email_address: input.emailAddress,
          health_status: "active",
          status: "active",
          daily_send_count: 0,
        },
        { onConflict: "project_id,email_address" },
      )
      .select("id, email_address")
      .single();
  }

  const { data: rawGmailAccount, error: gmailError } = gmailAccountResult;

  if (gmailError) {
    throw gmailError;
  }

  await refreshWorkspaceUsageCounters(input.workspaceId);

  return rawGmailAccount as { id: string; email_address: string; approval_status?: string | null };
}

export async function getWorkspaceGmailAccounts(
  workspaceId: string,
  options?: { onlyApproved?: boolean; projectId?: string },
) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("gmail_accounts")
    .select("id, email_address, status, health_status, approval_status, approved_at, approval_note, user_id, last_synced_at")
    .eq("workspace_id", workspaceId);

  if (options?.projectId) {
    query = query.eq("project_id", options.projectId);
  }

  if (options?.onlyApproved) {
    query = query.eq("approval_status", "approved");
  }

  let result = await query.order("created_at", { ascending: false });

  if (
    isAnyMissingColumnResult(result, [
      { table: "gmail_accounts", column: "approval_status" },
      { table: "gmail_accounts", column: "approved_at" },
      { table: "gmail_accounts", column: "approval_note" },
    ])
  ) {
    let fallbackQuery = supabase
      .from("gmail_accounts")
      .select("id, email_address, status, health_status, user_id, last_synced_at")
      .eq("workspace_id", workspaceId);

    if (options?.projectId) {
      fallbackQuery = fallbackQuery.eq("project_id", options.projectId);
    }

    result = await fallbackQuery.order("created_at", { ascending: false });
  }

  const { data, error } = result;

  if (error) {
    throw error;
  }

  return data as Array<{
    id: string;
    email_address: string;
    status: string;
    approval_status?: string | null;
    approved_at?: string | null;
    approval_note?: string | null;
    user_id?: string | null;
    health_status?: string | null;
    last_synced_at?: string | null;
  }>;
}

export async function approveGmailAccount(input: {
  workspaceId: string;
  gmailAccountId: string;
  actorUserId: string;
  approvalStatus: "approved" | "rejected";
  approvalNote?: string | null;
}) {
  requireSupabaseConfiguration();
  await assertWorkspaceCanConnectMailbox(input.workspaceId);

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("gmail_accounts")
    .update({
      approval_status: input.approvalStatus,
      approved_by_user_id: input.actorUserId,
      approved_at: new Date().toISOString(),
      approval_note: input.approvalNote?.trim() || null,
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.gmailAccountId);

  if (error && !isMissingColumnError(error.message, "gmail_accounts", "approval_status")) {
    throw error;
  }

  await refreshWorkspaceUsageCounters(input.workspaceId);

  return {
    gmailAccountId: input.gmailAccountId,
    approvalStatus: input.approvalStatus,
  };
}

export async function refreshMailboxToken(connectionId: string) {
  requireGoogleConfiguration();
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data: rawConnection, error } = await supabase
    .from("oauth_connections")
    .select("id, refresh_token_encrypted")
    .eq("id", connectionId)
    .single();
  const data = rawConnection as
    | { id: string; refresh_token_encrypted: string | null }
    | null;

  if (error || !data || !data.refresh_token_encrypted) {
    throw error ?? new Error("Missing refresh token.");
  }

  const auth = createOAuthClient();
  auth.setCredentials({
    refresh_token: decryptToken(data.refresh_token_encrypted),
  });
  const { credentials } = await auth.refreshAccessToken();

  await supabase
    .from("oauth_connections")
    .update({
      access_token_encrypted: credentials.access_token
        ? encryptToken(credentials.access_token)
        : null,
      token_expiry: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null,
      refresh_token_encrypted: credentials.refresh_token
        ? encryptToken(credentials.refresh_token)
        : data.refresh_token_encrypted,
      status: "active",
    })
    .eq("id", connectionId);

  return {
    accessToken: credentials.access_token ?? "",
    refreshToken: credentials.refresh_token ?? null,
    tokenExpiry: credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : null,
  };
}

export async function disconnectMailbox(workspaceId: string, gmailAccountId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("gmail_accounts")
    .update({
      status: "paused",
      health_status: "disconnected",
    })
    .eq("workspace_id", workspaceId)
    .eq("id", gmailAccountId);

  await refreshWorkspaceUsageCounters(workspaceId);
}

export async function sendWithMailboxProvider(input: {
  accessToken: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  replyThreadId?: string | null;
}) {
  return getMailboxProvider("gmail").sendMessage(input);
}

export async function getMailboxAccessTokenForAccount(gmailAccountId: string) {
  requireSupabaseConfiguration();
  requireGoogleConfiguration();

  const supabase = createAdminSupabaseClient();
  let mailboxResult = await supabase
    .from("gmail_accounts")
    .select(
      "id, email_address, approval_status, oauth_connection:oauth_connections(id, access_token_encrypted, refresh_token_encrypted, token_expiry)",
    )
    .eq("id", gmailAccountId)
    .single();

  if (isMissingColumnResult(mailboxResult, "gmail_accounts", "approval_status")) {
    mailboxResult = await supabase
      .from("gmail_accounts")
      .select(
        "id, email_address, oauth_connection:oauth_connections(id, access_token_encrypted, refresh_token_encrypted, token_expiry)",
      )
      .eq("id", gmailAccountId)
      .single();
  }

  const data = mailboxResult.data as
    | {
        id: string;
        email_address: string;
        approval_status?: string | null;
        oauth_connection?: {
          id: string;
          access_token_encrypted: string | null;
          refresh_token_encrypted: string | null;
          token_expiry: string | null;
        } | null;
      }
    | null;

  if (mailboxResult.error || !data?.oauth_connection) {
    throw mailboxResult.error ?? new Error("Mailbox connection not found.");
  }

  if (typeof data.approval_status !== "undefined" && data.approval_status !== "approved") {
    throw new Error("Mailbox is pending workspace approval.");
  }

  const oauthConnection = data.oauth_connection as {
    id: string;
    access_token_encrypted: string | null;
    token_expiry: string | null;
  };

  const shouldRefresh =
    !oauthConnection.access_token_encrypted ||
    (oauthConnection.token_expiry &&
      new Date(oauthConnection.token_expiry).getTime() <= Date.now() + 60_000);

  if (shouldRefresh) {
    const refreshed = await refreshMailboxToken(oauthConnection.id);
    return {
      emailAddress: data.email_address,
      accessToken: refreshed.accessToken,
    };
  }

  if (!oauthConnection.access_token_encrypted) {
    throw new Error("Mailbox access token is missing.");
  }

  return {
    emailAddress: data.email_address,
    accessToken: decryptToken(oauthConnection.access_token_encrypted),
  };
}

export async function sendReplyToThread(input: {
  threadRecordId: string;
  body: string;
}) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data: rawThreadRecord, error } = await supabase
    .from("message_threads")
    .select(
      "id, gmail_thread_id, subject, campaign_contact_id, thread_messages(id, direction, from_email, to_emails, sent_at), campaign_contact:campaign_contacts(campaign:campaigns(gmail_account_id, workspace_id))",
    )
    .eq("id", input.threadRecordId)
    .single();

  const threadRecord = rawThreadRecord as
    | {
        id: string;
        gmail_thread_id: string;
        subject: string | null;
        campaign_contact_id?: string | null;
        thread_messages?: Array<{
          direction: string;
          from_email: string | null;
          to_emails: string[] | null;
          sent_at: string;
        }> | null;
        campaign_contact?: {
          campaign?: { gmail_account_id?: string; workspace_id?: string } | null;
        } | null;
      }
    | null;

  if (error || !threadRecord) {
    throw error ?? new Error("Thread not found.");
  }

  const campaign = (
    threadRecord.campaign_contact as {
      campaign?: { gmail_account_id?: string; workspace_id?: string } | null;
    } | null
  )?.campaign;

  if (!campaign?.gmail_account_id || !campaign.workspace_id) {
    throw new Error("Thread is not linked to a campaign mailbox.");
  }

  const messages =
    (threadRecord.thread_messages as Array<{
      direction: string;
      from_email: string | null;
      to_emails: string[] | null;
      sent_at: string;
    }> | null) ?? [];
  const latestInbound = [...messages]
    .filter((message) => message.direction === "inbound" && message.from_email)
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];
  const recipientEmail =
    latestInbound?.from_email ??
    messages.find((message) => message.direction === "outbound")?.to_emails?.[0];

  if (!recipientEmail) {
    throw new Error("Could not determine the reply recipient.");
  }

  const mailbox = await getMailboxAccessTokenForAccount(campaign.gmail_account_id);
  const sendResult = await sendWithMailboxProvider({
    accessToken: mailbox.accessToken,
    fromEmail: mailbox.emailAddress,
    toEmail: recipientEmail,
    subject: threadRecord.subject?.startsWith("Re:")
      ? (threadRecord.subject ?? "Re:")
      : `Re: ${threadRecord.subject ?? "Conversation"}`,
    bodyHtml: input.body.replace(/\n/g, "<br />"),
    bodyText: input.body,
    replyThreadId: threadRecord.gmail_thread_id,
  });

  await supabase.from("thread_messages").insert({
    gmail_thread_id: threadRecord.gmail_thread_id,
    gmail_message_id: sendResult.messageId,
    direction: "outbound",
    from_email: mailbox.emailAddress,
    to_emails: [recipientEmail],
    subject: threadRecord.subject?.startsWith("Re:")
      ? (threadRecord.subject ?? "Re:")
      : `Re: ${threadRecord.subject ?? "Conversation"}`,
    snippet: input.body.slice(0, 120),
    body_text: input.body,
    body_html: input.body.replace(/\n/g, "<br />"),
    headers_jsonb: {},
    sent_at: new Date().toISOString(),
  });

  await supabase
    .from("message_threads")
    .update({
      latest_message_at: new Date().toISOString(),
      snippet: input.body.slice(0, 120),
    })
    .eq("id", input.threadRecordId);

  return {
    gmailMessageId: sendResult.messageId,
    gmailThreadId: sendResult.threadId,
    recipientEmail,
  };
}

export async function syncWorkspaceReplies(workspaceId: string, projectId?: string) {
  requireSupabaseConfiguration();

  if (!isGoogleConfigured) {
    return { syncedThreads: 0, inboundMessages: 0, mailboxErrors: 0 };
  }

  const supabase = createAdminSupabaseClient();
  let mailboxQuery = supabase
    .from("gmail_accounts")
    .select("id, workspace_id, project_id, email_address, last_history_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  if (projectId) {
    mailboxQuery = mailboxQuery.eq("project_id", projectId);
  }

  const { data: rawMailboxes, error } = await mailboxQuery;

  if (error) {
    throw error;
  }

  const mailboxes = (rawMailboxes ?? []) as Array<{
    id: string;
    workspace_id: string;
    project_id: string;
    email_address: string;
    last_history_id?: string | null;
  }>;

  let syncedThreads = 0;
  let inboundMessages = 0;
  let mailboxErrors = 0;

  for (const mailbox of mailboxes) {
    try {
      const access = await getMailboxAccessTokenForAccount(mailbox.id);
      const syncResult = await getMailboxProvider("gmail").syncThreads({
        accessToken: access.accessToken,
        userEmail: mailbox.email_address,
        historyId: mailbox.last_history_id ?? undefined,
      });

      for (const thread of syncResult.threads) {
        const latestMessage = [...thread.messages].sort(
          (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
        )[0];
        const { data: existingThread } = await supabase
          .from("message_threads")
          .select("id, campaign_contact_id, project_id")
          .eq("gmail_thread_id", thread.gmailThreadId)
          .maybeSingle();

        const { data: rawThreadRecord, error: threadError } = await supabase
          .from("message_threads")
          .upsert({
            workspace_id: mailbox.workspace_id,
            project_id:
              (existingThread as { project_id?: string | null } | null)?.project_id ?? mailbox.project_id,
            campaign_contact_id:
              (existingThread as { campaign_contact_id?: string | null } | null)?.campaign_contact_id ?? null,
            gmail_thread_id: thread.gmailThreadId,
            subject: latestMessage?.subject ?? null,
            snippet:
              latestMessage?.snippet ??
              latestMessage?.bodyText?.slice(0, 120) ??
              latestMessage?.subject ??
              null,
            latest_message_at: latestMessage?.sentAt ?? new Date().toISOString(),
          })
          .select("id, campaign_contact_id")
          .single();

        if (threadError) {
          throw threadError;
        }

        const threadRecord = rawThreadRecord as {
          id: string;
          campaign_contact_id?: string | null;
        };

        for (const message of thread.messages) {
          await supabase.from("thread_messages").upsert({
            gmail_thread_id: thread.gmailThreadId,
            gmail_message_id: message.gmailMessageId,
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

          if (message.direction === "inbound" && threadRecord.campaign_contact_id) {
            const disposition = classifyReplyDisposition(
              [message.subject ?? "", message.bodyText ?? "", message.snippet ?? ""].filter(Boolean).join("\n"),
            );
            const { data: rawCampaignContact } = await supabase
              .from("campaign_contacts")
              .select("contact_id")
              .eq("id", threadRecord.campaign_contact_id)
              .maybeSingle();
            const campaignContact = rawCampaignContact as { contact_id?: string | null } | null;
            inboundMessages += 1;
            await updateCampaignContactReplyState(threadRecord.campaign_contact_id, {
              status:
                disposition === "negative"
                  ? "unsubscribed"
                  : disposition === "booked"
                    ? "meeting_booked"
                    : "replied",
              replied_at: message.sentAt,
              reply_disposition: disposition,
              meeting_booked_at: disposition === "booked" ? message.sentAt : null,
              exit_reason: disposition === "negative" ? "negative_reply" : disposition === "booked" ? "meeting_booked" : "reply_received",
              next_due_at: null,
            });
            await cancelPendingCampaignJobs(threadRecord.campaign_contact_id, {
              reason:
                disposition === "negative"
                  ? "Negative reply received"
                  : disposition === "booked"
                    ? "Meeting booked"
                    : "Reply received",
            });

            if (disposition === "negative") {
              await supabase
                .from("contacts")
                .update({ unsubscribed_at: message.sentAt })
                .eq("id", campaignContact?.contact_id ?? "");
            }

            await recordMessageEvent({
              workspaceId,
              campaignContactId: threadRecord.campaign_contact_id,
              gmailMessageId: message.gmailMessageId,
              eventType:
                disposition === "negative"
                  ? "unsubscribed"
                  : disposition === "booked"
                    ? "meeting_booked"
                    : "replied",
              metadata: {
                disposition,
                fromEmail: message.fromEmail,
                subject: message.subject,
              },
            });
          }
        }

        syncedThreads += 1;
      }

      await supabase
        .from("gmail_accounts")
        .update({
          health_status: "active",
          last_history_id: syncResult.historyId ?? mailbox.last_history_id ?? null,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", mailbox.id);
    } catch (error) {
      console.error("Failed to sync mailbox", mailbox.email_address, error);
      await supabase
        .from("gmail_accounts")
        .update({
          health_status: "needs_reauth",
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", mailbox.id);
      mailboxErrors += 1;
    }
  }

  return { syncedThreads, inboundMessages, mailboxErrors };
}
