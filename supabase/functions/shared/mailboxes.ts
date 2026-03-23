import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isMissingTableResult } from "../../../src/lib/utils/supabase-schema.ts";
import { decryptToken, encryptToken } from "./crypto.ts";
import { gmailRefreshAccessToken } from "./gmail.ts";
import { microsoftRefreshAccessToken } from "./outlook.ts";

export type WorkerMailboxProviderKey = "gmail" | "outlook";

type WorkerOauthConnection = {
  id?: string;
  access_token_encrypted?: string | null;
  refresh_token_encrypted?: string | null;
  token_expiry?: string | null;
} | null;

export type WorkerMailboxRecord = {
  id: string;
  workspace_id: string;
  project_id: string;
  provider: WorkerMailboxProviderKey;
  email_address: string;
  provider_account_label?: string | null;
  approval_status?: string | null;
  status?: string | null;
  health_status?: string | null;
  last_sync_cursor?: string | null;
  last_synced_at?: string | null;
  oauth_connection?: WorkerOauthConnection;
};

type SupabaseLike = Pick<SupabaseClient, "from">;

function mapLegacyGmailMailbox(record: {
  id: string;
  workspace_id: string;
  project_id: string;
  email_address: string;
  approval_status?: string | null;
  status?: string | null;
  health_status?: string | null;
  last_history_id?: string | null;
  last_synced_at?: string | null;
  oauth_connection?: WorkerOauthConnection;
}) {
  return {
    id: record.id,
    workspace_id: record.workspace_id,
    project_id: record.project_id,
    provider: "gmail" as const,
    email_address: record.email_address,
    provider_account_label: record.email_address,
    approval_status: record.approval_status ?? null,
    status: record.status ?? "active",
    health_status: record.health_status ?? null,
    last_sync_cursor: record.last_history_id ?? null,
    last_synced_at: record.last_synced_at ?? null,
    oauth_connection: record.oauth_connection ?? null,
  };
}

export async function listActiveMailboxAccounts(supabase: SupabaseLike) {
  let result = await supabase
    .from("mailbox_accounts")
    .select(
      "id, workspace_id, project_id, provider, email_address, provider_account_label, approval_status, status, health_status, last_sync_cursor, last_synced_at, oauth_connection:oauth_connections(id, access_token_encrypted, refresh_token_encrypted, token_expiry)",
    )
    .eq("status", "active");

  if (result.error && isMissingTableResult(result, "mailbox_accounts")) {
    result = await supabase
      .from("gmail_accounts")
      .select(
        "id, workspace_id, project_id, email_address, approval_status, status, health_status, last_history_id, last_synced_at, oauth_connection:oauth_connections(id, access_token_encrypted, refresh_token_encrypted, token_expiry)",
      )
      .eq("status", "active");

    if (result.error) {
      throw result.error;
    }

    return ((result.data ?? []) as Array<{
      id: string;
      workspace_id: string;
      project_id: string;
      email_address: string;
      approval_status?: string | null;
      status?: string | null;
      health_status?: string | null;
      last_history_id?: string | null;
      last_synced_at?: string | null;
      oauth_connection?: WorkerOauthConnection;
    }>).map(mapLegacyGmailMailbox);
  }

  if (result.error) {
    throw result.error;
  }

  return ((result.data ?? []) as WorkerMailboxRecord[]).map((mailbox) => ({
    ...mailbox,
    provider: mailbox.provider ?? "gmail",
  }));
}

export async function getMailboxAccountById(supabase: SupabaseLike, mailboxAccountId: string) {
  const result = await supabase
    .from("mailbox_accounts")
    .select(
      "id, workspace_id, project_id, provider, email_address, provider_account_label, approval_status, status, health_status, last_sync_cursor, last_synced_at, oauth_connection:oauth_connections(id, access_token_encrypted, refresh_token_encrypted, token_expiry)",
    )
    .eq("id", mailboxAccountId)
    .maybeSingle();

  if (result.error && !isMissingTableResult(result, "mailbox_accounts")) {
    throw result.error;
  }

  if (result.data) {
    return {
      ...(result.data as WorkerMailboxRecord),
      provider: ((result.data as WorkerMailboxRecord).provider ?? "gmail") as WorkerMailboxProviderKey,
    };
  }

  const legacyResult = await supabase
    .from("gmail_accounts")
    .select(
      "id, workspace_id, project_id, email_address, approval_status, status, health_status, last_history_id, last_synced_at, oauth_connection:oauth_connections(id, access_token_encrypted, refresh_token_encrypted, token_expiry)",
    )
    .eq("id", mailboxAccountId)
    .maybeSingle();

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  if (!legacyResult.data) {
    return null;
  }

  return mapLegacyGmailMailbox(legacyResult.data as {
    id: string;
    workspace_id: string;
    project_id: string;
    email_address: string;
    approval_status?: string | null;
    status?: string | null;
    health_status?: string | null;
    last_history_id?: string | null;
    last_synced_at?: string | null;
    oauth_connection?: WorkerOauthConnection;
  });
}

export async function resolveMailboxAccess(supabase: SupabaseLike, mailbox: WorkerMailboxRecord) {
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

  const refreshToken = await decryptToken(oauthConnection.refresh_token_encrypted);
  const refreshed =
    mailbox.provider === "outlook"
      ? await microsoftRefreshAccessToken(refreshToken)
      : await gmailRefreshAccessToken(refreshToken);
  const accessToken = refreshed.access_token;

  if (!accessToken) {
    throw new Error("Mailbox token refresh did not return an access token.");
  }

  await supabase
    .from("oauth_connections")
    .update({
      access_token_encrypted: await encryptToken(accessToken),
      refresh_token_encrypted: refreshed.refresh_token
        ? await encryptToken(refreshed.refresh_token)
        : undefined,
      token_expiry: refreshed.expires_in
        ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString()
        : null,
    })
    .eq("id", oauthConnection.id);

  return accessToken;
}

export async function updateMailboxSyncState(
  supabase: SupabaseLike,
  mailbox: WorkerMailboxRecord,
  input: {
    healthStatus: "active" | "needs_reauth" | "disconnected";
    syncCursor?: string | null;
    syncedAt?: string;
  },
) {
  const syncedAt = input.syncedAt ?? new Date().toISOString();

  const mailboxUpdateResult = await supabase
    .from("mailbox_accounts")
    .update({
      health_status: input.healthStatus,
      last_sync_cursor: input.syncCursor ?? mailbox.last_sync_cursor ?? null,
      last_synced_at: syncedAt,
    })
    .eq("id", mailbox.id);

  if (mailboxUpdateResult.error && !isMissingTableResult(mailboxUpdateResult, "mailbox_accounts")) {
    throw mailboxUpdateResult.error;
  }

  if (mailbox.provider === "gmail") {
    const legacyUpdateResult = await supabase
      .from("gmail_accounts")
      .update({
        health_status: input.healthStatus,
        last_history_id: input.syncCursor ?? mailbox.last_sync_cursor ?? null,
        last_synced_at: syncedAt,
      })
      .eq("id", mailbox.id);

    if (legacyUpdateResult.error) {
      throw legacyUpdateResult.error;
    }
  }
}
