import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/crypto/tokens";
import { requireSupabaseConfiguration } from "@/lib/supabase/env";
import { isAnyMissingColumnResult, isMissingColumnError, isMissingTableResult } from "@/lib/utils/supabase-schema";
import { assertWorkspaceCanCreateSeedInbox, refreshWorkspaceUsageCounters } from "@/services/entitlement-service";

export async function storeSeedInboxConnection(input: {
  workspaceId: string;
  userId: string;
  provider: string;
  emailAddress: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiry: string | null;
}) {
  requireSupabaseConfiguration();
  await assertWorkspaceCanCreateSeedInbox(input.workspaceId);
  const supabase = createAdminSupabaseClient();
  const { data: oauthConnection, error: oauthError } = await supabase
    .from("oauth_connections")
    .upsert(
      {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        provider: `${input.provider}_seed_monitor`,
        email_address: input.emailAddress,
        access_token_encrypted: encryptToken(input.accessToken),
        refresh_token_encrypted: input.refreshToken ? encryptToken(input.refreshToken) : null,
        token_expiry: input.tokenExpiry,
        scopes: [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.modify",
        ],
        status: "active",
      },
      { onConflict: "workspace_id,provider,email_address" },
    )
    .select("id")
    .single();

  if (oauthError) {
    throw oauthError;
  }

  let result = await supabase
    .from("seed_inboxes")
    .upsert(
      {
        workspace_id: input.workspaceId,
        provider: input.provider,
        email_address: input.emailAddress,
        status: "active",
        oauth_connection_id: (oauthConnection as { id: string }).id,
        connection_status: "connected",
        health_status: "healthy",
        monitoring_enabled: true,
        reconnect_required: false,
        monitor_metadata_jsonb: {
          connectedByUserId: input.userId,
        },
        last_error: null,
      },
      { onConflict: "workspace_id,email_address" },
    )
    .select("id")
    .single();

  if (
    isAnyMissingColumnResult(result, [
      { table: "seed_inboxes", column: "oauth_connection_id" },
      { table: "seed_inboxes", column: "connection_status" },
      { table: "seed_inboxes", column: "monitoring_enabled" },
    ])
  ) {
    result = await supabase
      .from("seed_inboxes")
      .upsert(
        {
          workspace_id: input.workspaceId,
          provider: input.provider,
          email_address: input.emailAddress,
          status: "active",
          last_error: null,
        },
        { onConflict: "workspace_id,email_address" },
      )
      .select("id")
      .single();
  }

  if (result.error) {
    throw result.error;
  }

  await refreshWorkspaceUsageCounters(input.workspaceId);

  return result.data as { id: string };
}

export async function createSeedInboxRecord(input: {
  workspaceId: string;
  provider: string;
  emailAddress: string;
  status?: string;
}) {
  requireSupabaseConfiguration();
  await assertWorkspaceCanCreateSeedInbox(input.workspaceId);
  const supabase = createAdminSupabaseClient();
  let result = await supabase.from("seed_inboxes").insert({
    workspace_id: input.workspaceId,
    provider: input.provider,
    email_address: input.emailAddress,
    status: input.status ?? "active",
    connection_status: input.provider === "gmail" ? "pending" : "connected",
    health_status: input.provider === "gmail" ? "warning" : "healthy",
    monitoring_enabled: true,
  });

  if (
    result.error &&
    (
      isMissingColumnError(result.error.message, "seed_inboxes", "connection_status") ||
      isMissingColumnError(result.error.message, "seed_inboxes", "monitoring_enabled")
    )
  ) {
    result = await supabase.from("seed_inboxes").insert({
      workspace_id: input.workspaceId,
      provider: input.provider,
      email_address: input.emailAddress,
      status: input.status ?? "active",
    });
  }

  if (result.error) {
    throw result.error;
  }

  await refreshWorkspaceUsageCounters(input.workspaceId);
}

export async function updateSeedInboxRecord(input: {
  workspaceId: string;
  seedInboxId: string;
  status?: string;
  monitoringEnabled?: boolean;
}) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const payload: Record<string, unknown> = {};

  if (input.status) {
    payload.status = input.status;
  }

  if (typeof input.monitoringEnabled === "boolean") {
    payload.monitoring_enabled = input.monitoringEnabled;
  }

  let result = await supabase
    .from("seed_inboxes")
    .update(payload)
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.seedInboxId);

  if (isAnyMissingColumnResult(result, [{ table: "seed_inboxes", column: "monitoring_enabled" }])) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.monitoring_enabled;
    result = await supabase
      .from("seed_inboxes")
      .update(fallbackPayload)
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.seedInboxId);
  }

  if (result.error) {
    throw result.error;
  }

  await refreshWorkspaceUsageCounters(input.workspaceId);
}

export async function queueSeedProbeJobs(workspaceId: string) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  let seedInboxesResult = await supabase
    .from("seed_inboxes")
    .select("id, email_address, provider, monitoring_enabled, connection_status")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  if (
    isAnyMissingColumnResult(seedInboxesResult, [
      { table: "seed_inboxes", column: "monitoring_enabled" },
      { table: "seed_inboxes", column: "connection_status" },
    ])
  ) {
    seedInboxesResult = await supabase
      .from("seed_inboxes")
      .select("id, email_address, provider")
      .eq("workspace_id", workspaceId)
      .eq("status", "active");
  }

  if (seedInboxesResult.error && !isMissingTableResult(seedInboxesResult, "seed_inboxes")) {
    throw seedInboxesResult.error;
  }

  const gmailAccountsResult = await supabase
    .from("gmail_accounts")
    .select("id, email_address, approval_status, status, health_status")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  if (gmailAccountsResult.error) {
    throw gmailAccountsResult.error;
  }

  const seedInboxes = ((seedInboxesResult.data ?? []) as Array<{
    id: string;
    email_address: string;
    provider: string;
    monitoring_enabled?: boolean;
    connection_status?: string;
  }>).filter(
    (inbox) =>
      inbox.provider === "gmail" &&
      (typeof inbox.monitoring_enabled === "undefined" || inbox.monitoring_enabled) &&
      (typeof inbox.connection_status === "undefined" || inbox.connection_status === "connected"),
  );
  const senders = ((gmailAccountsResult.data ?? []) as Array<{
    id: string;
    email_address: string;
    approval_status?: string | null;
    status: string;
    health_status?: string | null;
  }>).filter(
    (account) =>
      account.status === "active" &&
      (typeof account.approval_status === "undefined" || account.approval_status === "approved") &&
      account.health_status === "active",
  );

  if (!seedInboxes.length || !senders.length) {
    return { queued: 0 };
  }

  const createdAt = new Date();
  const jobs = seedInboxes.flatMap((inbox) =>
    senders.map((sender) => {
      const probeKey = `${createdAt.toISOString().slice(0, 13).replace(/[-:T]/g, "")}-${sender.id.slice(0, 6)}-${inbox.id.slice(0, 6)}`;
      return {
        workspace_id: workspaceId,
        seed_inbox_id: inbox.id,
        sender_gmail_account_id: sender.id,
        probe_key: probeKey,
        subject: `OutboundFlow placement check ${probeKey}`,
        status: "pending",
        payload_jsonb: {
          recipientEmail: inbox.email_address,
          senderEmail: sender.email_address,
        },
      };
    }),
  );

  const result = await (
    supabase.from("seed_probe_jobs") as unknown as {
      insert: (
        values: Array<Record<string, unknown>>,
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).insert(jobs);

  if (result.error && !isMissingTableResult(result, "seed_probe_jobs")) {
    throw result.error;
  }

  return { queued: jobs.length };
}

export async function getWorkspaceSeedMonitorSummary(workspaceId: string) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const [seedInboxes, recentResults] = await Promise.all([
    supabase
      .from("seed_inboxes")
      .select(
        "id, provider, email_address, status, connection_status, health_status, last_checked_at, last_probe_at, last_result_status, last_error",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("seed_inbox_results")
      .select("id, seed_inbox_id, placement_status, observed_at, probe_key")
      .eq("workspace_id", workspaceId)
      .order("observed_at", { ascending: false })
      .limit(20),
  ]);

  return {
    seedInboxes: isMissingTableResult(seedInboxes, "seed_inboxes")
      ? []
      : ((seedInboxes.data ?? []) as Array<Record<string, unknown>>),
    recentResults: isMissingTableResult(recentResults, "seed_inbox_results")
      ? []
      : ((recentResults.data ?? []) as Array<Record<string, unknown>>),
  };
}
