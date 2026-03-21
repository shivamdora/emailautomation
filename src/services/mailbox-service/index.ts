import "server-only";
import { google } from "googleapis";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { classifyReplyDisposition } from "@/lib/utils/reply-disposition";
import {
  isAnyMissingColumnResult,
  isMissingColumnError,
  isMissingColumnResult,
  isMissingTableResult,
} from "@/lib/utils/supabase-schema";
import {
  env,
  isGoogleConfigured,
  isMicrosoftConfigured,
  requireGoogleConfiguration,
  requireMicrosoftConfiguration,
  requireSupabaseConfiguration,
} from "@/lib/supabase/env";
import type { MailboxProviderKey } from "@/services/mailbox-providers/types";
import { cancelPendingCampaignJobs } from "@/services/campaign-send-queue-service";
import { assertWorkspaceCanConnectMailbox, refreshWorkspaceUsageCounters } from "@/services/entitlement-service";
import { getMailboxProvider } from "@/services/mailbox-providers";
import { recordMessageEvent } from "@/services/telemetry-service";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

const MICROSOFT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Mail.Send",
  "Mail.ReadWrite",
];

type StoredMailboxConnection = {
  id: string;
  provider: MailboxProviderKey;
  email_address: string;
  approval_status?: string | null;
  oauth_connection?: {
    id: string;
    access_token_encrypted: string | null;
    refresh_token_encrypted: string | null;
    token_expiry: string | null;
  } | null;
};

export type MailboxAccountListItem = {
  id: string;
  provider: MailboxProviderKey;
  email_address: string;
  provider_account_label?: string | null;
  status: string;
  approval_status?: string | null;
  approved_at?: string | null;
  approval_note?: string | null;
  user_id?: string | null;
  health_status?: string | null;
  last_synced_at?: string | null;
  last_sync_cursor?: string | null;
};

function createGoogleOAuthClient(redirectUri?: string) {
  requireGoogleConfiguration();

  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    redirectUri ?? env.GOOGLE_OAUTH_REDIRECT_URI,
  );
}

function getMicrosoftAuthorityBaseUrl() {
  const tenant = env.MICROSOFT_TENANT_ID?.trim() || "common";
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;
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

async function exchangeMicrosoftCodeInternal(code: string, redirectUri?: string) {
  requireMicrosoftConfiguration();

  const tokenResponse = await fetch(`${getMicrosoftAuthorityBaseUrl()}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID ?? "",
      client_secret: env.MICROSOFT_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri ?? env.MICROSOFT_OAUTH_REDIRECT_URI ?? "",
      scope: MICROSOFT_SCOPES.join(" "),
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Microsoft OAuth exchange failed: ${await tokenResponse.text()}`);
  }

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!tokenPayload.access_token) {
    throw new Error("Microsoft OAuth exchange did not return an access token.");
  }

  const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${tokenPayload.access_token}`,
    },
  });

  if (!profileResponse.ok) {
    throw new Error(`Microsoft Graph profile lookup failed: ${await profileResponse.text()}`);
  }

  const profile = (await profileResponse.json()) as {
    displayName?: string | null;
    mail?: string | null;
    userPrincipalName?: string | null;
  };
  const emailAddress = profile.mail?.trim() || profile.userPrincipalName?.trim();

  if (!emailAddress) {
    throw new Error("Microsoft OAuth exchange did not return a mailbox email address.");
  }

  return {
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token ?? null,
    tokenExpiry: tokenPayload.expires_in
      ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
      : null,
    emailAddress,
    scopes: MICROSOFT_SCOPES,
    providerAccountLabel: profile.displayName?.trim() || emailAddress,
  };
}

async function refreshGoogleToken(connectionId: string, refreshToken: string) {
  const auth = createGoogleOAuthClient();
  auth.setCredentials({
    refresh_token: refreshToken,
  });
  const { credentials } = await auth.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Google token refresh did not return an access token.");
  }

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("oauth_connections")
    .update({
      access_token_encrypted: encryptToken(credentials.access_token),
      token_expiry: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null,
      refresh_token_encrypted: credentials.refresh_token
        ? encryptToken(credentials.refresh_token)
        : undefined,
      status: "active",
    })
    .eq("id", connectionId);

  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token ?? null,
    tokenExpiry: credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : null,
  };
}

async function refreshMicrosoftToken(connectionId: string, refreshToken: string) {
  requireMicrosoftConfiguration();

  const response = await fetch(`${getMicrosoftAuthorityBaseUrl()}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID ?? "",
      client_secret: env.MICROSOFT_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: MICROSOFT_SCOPES.join(" "),
    }),
  });

  if (!response.ok) {
    throw new Error(`Microsoft token refresh failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    throw new Error("Microsoft token refresh did not return an access token.");
  }

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("oauth_connections")
    .update({
      access_token_encrypted: encryptToken(payload.access_token),
      refresh_token_encrypted: payload.refresh_token ? encryptToken(payload.refresh_token) : undefined,
      token_expiry: payload.expires_in
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null,
      status: "active",
    })
    .eq("id", connectionId);

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    tokenExpiry: payload.expires_in
      ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
      : null,
  };
}

function mapLegacyGmailAccounts(
  data: Array<{
    id: string;
    email_address: string;
    status: string;
    approval_status?: string | null;
    approved_at?: string | null;
    approval_note?: string | null;
    user_id?: string | null;
    health_status?: string | null;
    last_synced_at?: string | null;
    last_history_id?: string | null;
  }>,
) {
  return data.map((account) => ({
    ...account,
    provider: "gmail" as const,
    provider_account_label: account.email_address,
    last_sync_cursor: account.last_history_id ?? null,
  }));
}

async function listLegacyGmailAccounts(
  workspaceId: string,
  options?: { onlyApproved?: boolean; projectId?: string },
) {
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("gmail_accounts")
    .select("id, email_address, status, health_status, approval_status, approved_at, approval_note, user_id, last_synced_at, last_history_id")
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
      { table: "gmail_accounts", column: "last_history_id" },
    ])
  ) {
    let fallbackQuery = supabase
      .from("gmail_accounts")
      .select("id, email_address, status, health_status, user_id, last_synced_at")
      .eq("workspace_id", workspaceId);

    if (options?.projectId) {
      fallbackQuery = fallbackQuery.eq("project_id", options?.projectId);
    }

    result = await fallbackQuery.order("created_at", { ascending: false });
  }

  if (result.error) {
    throw result.error;
  }

  return mapLegacyGmailAccounts(
    (result.data ?? []) as Array<{
      id: string;
      email_address: string;
      status: string;
      approval_status?: string | null;
      approved_at?: string | null;
      approval_note?: string | null;
      user_id?: string | null;
      health_status?: string | null;
      last_synced_at?: string | null;
      last_history_id?: string | null;
    }>,
  );
}

async function mirrorLegacyGmailAccount(input: {
  mailboxAccountId: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  oauthConnectionId: string;
  emailAddress: string;
  status?: string;
  healthStatus?: string;
  approvalStatus?: string | null;
  approvalNote?: string | null;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
  lastSyncCursor?: string | null;
  lastSyncedAt?: string | null;
}) {
  const supabase = createAdminSupabaseClient();
  let gmailAccountResult = await supabase
    .from("gmail_accounts")
    .upsert(
      {
        id: input.mailboxAccountId,
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        user_id: input.userId,
        oauth_connection_id: input.oauthConnectionId,
        email_address: input.emailAddress,
        health_status: input.healthStatus ?? "active",
        status: input.status ?? "active",
        approval_status: input.approvalStatus ?? "pending",
        approved_by_user_id: input.approvedByUserId ?? null,
        approved_at: input.approvedAt ?? null,
        approval_note: input.approvalNote ?? "Awaiting workspace approval",
        daily_send_count: 0,
        last_history_id: input.lastSyncCursor ?? null,
        last_synced_at: input.lastSyncedAt ?? null,
      },
      { onConflict: "id" },
    )
    .select("id")
    .single();

  if (isMissingColumnResult(gmailAccountResult, "gmail_accounts", "approval_status")) {
    gmailAccountResult = await supabase
      .from("gmail_accounts")
      .upsert(
        {
          id: input.mailboxAccountId,
          workspace_id: input.workspaceId,
          project_id: input.projectId,
          user_id: input.userId,
          oauth_connection_id: input.oauthConnectionId,
          email_address: input.emailAddress,
          health_status: input.healthStatus ?? "active",
          status: input.status ?? "active",
          daily_send_count: 0,
          last_history_id: input.lastSyncCursor ?? null,
          last_synced_at: input.lastSyncedAt ?? null,
        },
        { onConflict: "id" },
      )
      .select("id")
      .single();
  }

  if (gmailAccountResult.error && !isMissingColumnError(gmailAccountResult.error.message, "gmail_accounts", "last_history_id")) {
    throw gmailAccountResult.error;
  }
}

export function createMailboxConnectUrl(
  provider: MailboxProviderKey,
  state: string,
  options?: { redirectUri?: string; scopes?: string[] },
) {
  if (provider === "gmail") {
    requireGoogleConfiguration();
    const auth = createGoogleOAuthClient(options?.redirectUri);
    return auth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: options?.scopes?.length ? options.scopes : GMAIL_SCOPES,
      state,
      include_granted_scopes: true,
    });
  }

  requireMicrosoftConfiguration();
  const redirectUri = options?.redirectUri ?? env.MICROSOFT_OAUTH_REDIRECT_URI ?? "";
  const url = new URL(`${getMicrosoftAuthorityBaseUrl()}/authorize`);
  url.searchParams.set("client_id", env.MICROSOFT_CLIENT_ID ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", (options?.scopes?.length ? options.scopes : MICROSOFT_SCOPES).join(" "));
  url.searchParams.set("state", state);

  return url.toString();
}

export function createGoogleConnectUrl(
  state: string,
  options?: { redirectUri?: string; scopes?: string[] },
) {
  return createMailboxConnectUrl("gmail", state, options);
}

export async function exchangeMailboxCode(
  provider: MailboxProviderKey,
  code: string,
  options?: { redirectUri?: string },
) {
  if (provider === "gmail") {
    const auth = createGoogleOAuthClient(options?.redirectUri);
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
      providerAccountLabel: data.emailAddress,
    };
  }

  return exchangeMicrosoftCodeInternal(code, options?.redirectUri);
}

export async function exchangeGoogleCode(code: string, options?: { redirectUri?: string }) {
  return exchangeMailboxCode("gmail", code, options);
}

export async function storeMailboxConnection(input: {
  provider: MailboxProviderKey;
  workspaceId: string;
  projectId: string;
  userId: string;
  emailAddress: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiry: string | null;
  scopes: string[];
  providerAccountLabel?: string | null;
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
        provider: input.provider,
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
  let mailboxAccountId = crypto.randomUUID();

  if (input.provider === "gmail") {
    const gmailAccountResult = await supabase
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
      .select("id")
      .single();

    if (gmailAccountResult.error) {
      throw gmailAccountResult.error;
    }

    mailboxAccountId = (gmailAccountResult.data as { id: string }).id;
  }

  const { data: rawMailboxAccount, error: mailboxError } = await supabase
    .from("mailbox_accounts")
    .upsert(
      {
        id: mailboxAccountId,
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        user_id: input.userId,
        oauth_connection_id: oauthConnection.id,
        provider: input.provider,
        email_address: input.emailAddress,
        provider_account_label: input.providerAccountLabel?.trim() || input.emailAddress,
        health_status: "active",
        status: "active",
        approval_status: "pending",
        approved_by_user_id: null,
        approved_at: null,
        approval_note: "Awaiting workspace approval",
        daily_send_count: 0,
      },
      { onConflict: "project_id,provider,email_address" },
    )
    .select("id, provider, email_address, approval_status, provider_account_label, status")
    .single();

  if (mailboxError) {
    if (isMissingTableResult({ error: mailboxError, data: null, status: 400 }, "mailbox_accounts") && input.provider === "gmail") {
      await mirrorLegacyGmailAccount({
        mailboxAccountId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        userId: input.userId,
        oauthConnectionId: oauthConnection.id,
        emailAddress: input.emailAddress,
      });

      await refreshWorkspaceUsageCounters(input.workspaceId);

      return {
        id: mailboxAccountId,
        provider: input.provider,
        email_address: input.emailAddress,
        approval_status: "pending",
        provider_account_label: input.providerAccountLabel?.trim() || input.emailAddress,
        status: "active",
      };
    }

    throw mailboxError;
  }

  if (input.provider === "gmail") {
    await mirrorLegacyGmailAccount({
      mailboxAccountId: (rawMailboxAccount as { id: string }).id,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      userId: input.userId,
      oauthConnectionId: oauthConnection.id,
      emailAddress: input.emailAddress,
    });
  }

  await refreshWorkspaceUsageCounters(input.workspaceId);

  return rawMailboxAccount as {
    id: string;
    provider: MailboxProviderKey;
    email_address: string;
    provider_account_label?: string | null;
    approval_status?: string | null;
    status: string;
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
  return storeMailboxConnection({
    provider: "gmail",
    ...input,
    providerAccountLabel: input.emailAddress,
  });
}

export async function getWorkspaceMailboxAccounts(
  workspaceId: string,
  options?: { onlyApproved?: boolean; projectId?: string; provider?: MailboxProviderKey },
) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("mailbox_accounts")
    .select("id, provider, email_address, provider_account_label, status, health_status, approval_status, approved_at, approval_note, user_id, last_synced_at, last_sync_cursor")
    .eq("workspace_id", workspaceId);

  if (options?.projectId) {
    query = query.eq("project_id", options.projectId);
  }

  if (options?.provider) {
    query = query.eq("provider", options.provider);
  }

  if (options?.onlyApproved) {
    query = query.eq("approval_status", "approved");
  }

  const result = await query.order("created_at", { ascending: false });

  if (result.error) {
    if (isMissingTableResult(result, "mailbox_accounts")) {
      return listLegacyGmailAccounts(workspaceId, options);
    }
    throw result.error;
  }

  return (result.data ?? []) as MailboxAccountListItem[];
}

export async function getWorkspaceGmailAccounts(
  workspaceId: string,
  options?: { onlyApproved?: boolean; projectId?: string },
) {
  return getWorkspaceMailboxAccounts(workspaceId, options);
}

export async function approveMailboxAccount(input: {
  workspaceId: string;
  mailboxAccountId: string;
  actorUserId: string;
  approvalStatus: "approved" | "rejected";
  approvalNote?: string | null;
}) {
  requireSupabaseConfiguration();
  await assertWorkspaceCanConnectMailbox(input.workspaceId);

  const supabase = createAdminSupabaseClient();
  const approvedAt = new Date().toISOString();
  const { data: mailboxRecord, error: mailboxReadError } = await supabase
    .from("mailbox_accounts")
    .select("id, provider")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.mailboxAccountId)
    .maybeSingle();

  if (mailboxReadError && !isMissingTableResult({ error: mailboxReadError, data: null, status: 400 }, "mailbox_accounts")) {
    throw mailboxReadError;
  }

  if (mailboxRecord) {
    const { error } = await supabase
      .from("mailbox_accounts")
      .update({
        approval_status: input.approvalStatus,
        approved_by_user_id: input.actorUserId,
        approved_at: approvedAt,
        approval_note: input.approvalNote?.trim() || null,
      })
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.mailboxAccountId);

    if (error) {
      throw error;
    }

    if ((mailboxRecord as { provider?: string | null }).provider === "gmail") {
      const { error: gmailMirrorError } = await supabase
        .from("gmail_accounts")
        .update({
          approval_status: input.approvalStatus,
          approved_by_user_id: input.actorUserId,
          approved_at: approvedAt,
          approval_note: input.approvalNote?.trim() || null,
        })
        .eq("workspace_id", input.workspaceId)
        .eq("id", input.mailboxAccountId);

      if (gmailMirrorError && !isMissingColumnError(gmailMirrorError.message, "gmail_accounts", "approval_status")) {
        throw gmailMirrorError;
      }
    }
  } else {
    const { error } = await supabase
      .from("gmail_accounts")
      .update({
        approval_status: input.approvalStatus,
        approved_by_user_id: input.actorUserId,
        approved_at: approvedAt,
        approval_note: input.approvalNote?.trim() || null,
      })
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.mailboxAccountId);

    if (error && !isMissingColumnError(error.message, "gmail_accounts", "approval_status")) {
      throw error;
    }
  }

  await refreshWorkspaceUsageCounters(input.workspaceId);

  return {
    mailboxAccountId: input.mailboxAccountId,
    approvalStatus: input.approvalStatus,
  };
}

export async function approveGmailAccount(input: {
  workspaceId: string;
  gmailAccountId: string;
  actorUserId: string;
  approvalStatus: "approved" | "rejected";
  approvalNote?: string | null;
}) {
  return approveMailboxAccount({
    workspaceId: input.workspaceId,
    mailboxAccountId: input.gmailAccountId,
    actorUserId: input.actorUserId,
    approvalStatus: input.approvalStatus,
    approvalNote: input.approvalNote,
  });
}

export async function refreshMailboxToken(connectionId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data: rawConnection, error } = await supabase
    .from("oauth_connections")
    .select("id, provider, refresh_token_encrypted")
    .eq("id", connectionId)
    .single();
  const data = rawConnection as
    | { id: string; provider: string; refresh_token_encrypted: string | null }
    | null;

  if (error || !data || !data.refresh_token_encrypted) {
    throw error ?? new Error("Missing refresh token.");
  }

  const refreshToken = decryptToken(data.refresh_token_encrypted);

  if (data.provider === "gmail") {
    return refreshGoogleToken(connectionId, refreshToken);
  }

  if (data.provider === "outlook") {
    return refreshMicrosoftToken(connectionId, refreshToken);
  }

  throw new Error(`Unsupported mailbox provider for token refresh: ${data.provider}`);
}

export async function disconnectMailbox(workspaceId: string, mailboxAccountId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data: mailboxRecord } = await supabase
    .from("mailbox_accounts")
    .select("provider")
    .eq("workspace_id", workspaceId)
    .eq("id", mailboxAccountId)
    .maybeSingle();

  if (mailboxRecord) {
    await supabase
      .from("mailbox_accounts")
      .update({
        status: "paused",
        health_status: "disconnected",
      })
      .eq("workspace_id", workspaceId)
      .eq("id", mailboxAccountId);
  }

  if (!mailboxRecord || (mailboxRecord as { provider?: string | null }).provider === "gmail") {
    await supabase
      .from("gmail_accounts")
      .update({
        status: "paused",
        health_status: "disconnected",
      })
      .eq("workspace_id", workspaceId)
      .eq("id", mailboxAccountId);
  }

  await refreshWorkspaceUsageCounters(workspaceId);
}

export async function getMailboxAccessTokenForAccount(mailboxAccountId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  let mailboxResult = await supabase
    .from("mailbox_accounts")
    .select(
      "id, provider, email_address, approval_status, oauth_connection:oauth_connections(id, access_token_encrypted, refresh_token_encrypted, token_expiry)",
    )
    .eq("id", mailboxAccountId)
    .single();

  if (mailboxResult.error && isMissingTableResult(mailboxResult, "mailbox_accounts")) {
    mailboxResult = await supabase
      .from("gmail_accounts")
      .select(
        "id, email_address, approval_status, oauth_connection:oauth_connections(id, access_token_encrypted, refresh_token_encrypted, token_expiry)",
      )
      .eq("id", mailboxAccountId)
      .single();
  }

  const data = mailboxResult.data as StoredMailboxConnection | null;

  if (mailboxResult.error || !data?.oauth_connection) {
    throw mailboxResult.error ?? new Error("Mailbox connection not found.");
  }

  if (typeof data.approval_status !== "undefined" && data.approval_status !== "approved") {
    throw new Error("Mailbox is pending workspace approval.");
  }

  const shouldRefresh =
    !data.oauth_connection.access_token_encrypted ||
    (data.oauth_connection.token_expiry &&
      new Date(data.oauth_connection.token_expiry).getTime() <= Date.now() + 60_000);

  if (shouldRefresh) {
    const refreshed = await refreshMailboxToken(data.oauth_connection.id);
    return {
      mailboxAccountId: data.id,
      provider: (data.provider ?? "gmail") as MailboxProviderKey,
      emailAddress: data.email_address,
      accessToken: refreshed.accessToken,
    };
  }

  if (!data.oauth_connection.access_token_encrypted) {
    throw new Error("Mailbox access token is missing.");
  }

  return {
    mailboxAccountId: data.id,
    provider: (data.provider ?? "gmail") as MailboxProviderKey,
    emailAddress: data.email_address,
    accessToken: decryptToken(data.oauth_connection.access_token_encrypted),
  };
}

export async function sendWithMailboxProvider(input: {
  provider: MailboxProviderKey;
  accessToken: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  replyThreadId?: string | null;
  replyMessageId?: string | null;
}) {
  return getMailboxProvider(input.provider).sendMessage(input);
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
      "id, gmail_thread_id, provider_thread_id, mailbox_account_id, subject, campaign_contact_id, thread_messages(id, direction, from_email, to_emails, sent_at, provider_message_id, gmail_message_id), campaign_contact:campaign_contacts(campaign:campaigns(mailbox_account_id, gmail_account_id, workspace_id))",
    )
    .eq("id", input.threadRecordId)
    .single();

  const threadRecord = rawThreadRecord as
    | {
        id: string;
        gmail_thread_id: string;
        provider_thread_id?: string | null;
        mailbox_account_id?: string | null;
        subject: string | null;
        campaign_contact_id?: string | null;
        thread_messages?: Array<{
          direction: string;
          from_email: string | null;
          to_emails: string[] | null;
          provider_message_id?: string | null;
          gmail_message_id?: string | null;
          sent_at: string;
        }> | null;
        campaign_contact?: {
          campaign?: { mailbox_account_id?: string | null; gmail_account_id?: string | null; workspace_id?: string } | null;
        } | null;
      }
    | null;

  if (error || !threadRecord) {
    throw error ?? new Error("Thread not found.");
  }

  const campaign = (
    threadRecord.campaign_contact as {
      campaign?: { mailbox_account_id?: string | null; gmail_account_id?: string | null; workspace_id?: string } | null;
    } | null
  )?.campaign;
  const mailboxAccountId = campaign?.mailbox_account_id ?? campaign?.gmail_account_id ?? threadRecord.mailbox_account_id;

  if (!mailboxAccountId || !campaign?.workspace_id) {
    throw new Error("Thread is not linked to a campaign mailbox.");
  }

  const messages =
    (threadRecord.thread_messages as Array<{
      direction: string;
      from_email: string | null;
      to_emails: string[] | null;
      provider_message_id?: string | null;
      gmail_message_id?: string | null;
      sent_at: string;
    }> | null) ?? [];
  const latestInbound = [...messages]
    .filter((message) => message.direction === "inbound" && message.from_email)
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];
  const latestMessage = [...messages]
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];
  const recipientEmail =
    latestInbound?.from_email ??
    messages.find((message) => message.direction === "outbound")?.to_emails?.[0];

  if (!recipientEmail) {
    throw new Error("Could not determine the reply recipient.");
  }

  const mailbox = await getMailboxAccessTokenForAccount(mailboxAccountId);
  const replyAnchorMessageId =
    latestInbound?.provider_message_id ??
    latestInbound?.gmail_message_id ??
    latestMessage?.provider_message_id ??
    latestMessage?.gmail_message_id ??
    null;

  const sendResult = await sendWithMailboxProvider({
    provider: mailbox.provider,
    accessToken: mailbox.accessToken,
    fromEmail: mailbox.emailAddress,
    toEmail: recipientEmail,
    subject: threadRecord.subject?.startsWith("Re:")
      ? (threadRecord.subject ?? "Re:")
      : `Re: ${threadRecord.subject ?? "Conversation"}`,
    bodyHtml: input.body.replace(/\n/g, "<br />"),
    bodyText: input.body,
    replyThreadId: threadRecord.provider_thread_id ?? threadRecord.gmail_thread_id,
    replyMessageId: replyAnchorMessageId,
  });

  await supabase.from("thread_messages").insert({
    gmail_thread_id: sendResult.threadId,
    gmail_message_id: sendResult.messageId,
    provider_message_id: sendResult.messageId,
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
      mailbox_account_id: mailbox.mailboxAccountId,
      provider_thread_id: sendResult.threadId,
      gmail_thread_id: sendResult.threadId,
      latest_message_at: new Date().toISOString(),
      snippet: input.body.slice(0, 120),
    })
    .eq("id", input.threadRecordId);

  return {
    providerMessageId: sendResult.messageId,
    providerThreadId: sendResult.threadId,
    gmailMessageId: sendResult.messageId,
    gmailThreadId: sendResult.threadId,
    recipientEmail,
  };
}

export async function syncWorkspaceReplies(workspaceId: string, projectId?: string) {
  requireSupabaseConfiguration();

  if (!isGoogleConfigured && !isMicrosoftConfigured) {
    return { syncedThreads: 0, inboundMessages: 0, mailboxErrors: 0 };
  }

  const supabase = createAdminSupabaseClient();
  const mailboxRows = await getWorkspaceMailboxAccounts(workspaceId, { projectId });
  const mailboxes = mailboxRows.filter((mailbox) => mailbox.status === "active");

  let syncedThreads = 0;
  let inboundMessages = 0;
  let mailboxErrors = 0;

  for (const mailbox of mailboxes) {
    try {
      const access = await getMailboxAccessTokenForAccount(mailbox.id);
      const syncResult = await getMailboxProvider(access.provider).syncThreads({
        accessToken: access.accessToken,
        userEmail: mailbox.email_address,
        syncCursor: mailbox.last_sync_cursor ?? undefined,
      });

      for (const thread of syncResult.threads) {
        const latestMessage = [...thread.messages].sort(
          (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
        )[0];
        let existingThreadResult = await supabase
          .from("message_threads")
          .select("id, campaign_contact_id, project_id")
          .eq("provider_thread_id", thread.providerThreadId)
          .maybeSingle();

        if (existingThreadResult.error && isMissingColumnResult(existingThreadResult, "message_threads", "provider_thread_id")) {
          existingThreadResult = await supabase
            .from("message_threads")
            .select("id, campaign_contact_id, project_id")
            .eq("gmail_thread_id", thread.providerThreadId)
            .maybeSingle();
        }

        const existingThread = existingThreadResult.data as
          | { campaign_contact_id?: string | null; project_id?: string | null }
          | null;

        const { data: rawThreadRecord, error: threadError } = await supabase
          .from("message_threads")
          .upsert({
            workspace_id: workspaceId,
            project_id: existingThread?.project_id ?? projectId ?? null,
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
              exit_reason:
                disposition === "negative"
                  ? "negative_reply"
                  : disposition === "booked"
                    ? "meeting_booked"
                    : "reply_received",
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
              gmailMessageId: message.providerMessageId,
              providerMessageId: message.providerMessageId,
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
                provider: mailbox.provider,
              },
            });
          }
        }

        syncedThreads += 1;
      }

      await supabase
        .from("mailbox_accounts")
        .update({
          health_status: "active",
          last_sync_cursor: syncResult.syncCursor ?? mailbox.last_sync_cursor ?? null,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", mailbox.id);

      if (mailbox.provider === "gmail") {
        await supabase
          .from("gmail_accounts")
          .update({
            health_status: "active",
            last_history_id: syncResult.syncCursor ?? mailbox.last_sync_cursor ?? null,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", mailbox.id);
      }
    } catch (error) {
      console.error("Failed to sync mailbox", mailbox.email_address, error);
      await supabase
        .from("mailbox_accounts")
        .update({
          health_status: "needs_reauth",
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", mailbox.id);

      if (mailbox.provider === "gmail") {
        await supabase
          .from("gmail_accounts")
          .update({
            health_status: "needs_reauth",
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", mailbox.id);
      }

      mailboxErrors += 1;
    }
  }

  return { syncedThreads, inboundMessages, mailboxErrors };
}
