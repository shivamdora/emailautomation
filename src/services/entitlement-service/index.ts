import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireSupabaseConfiguration } from "@/lib/supabase/env";
import { isAnyMissingColumnResult, isMissingColumnResult, isMissingTableResult } from "@/lib/utils/supabase-schema";
import { ensureWorkspaceBillingAccount, getWorkspacePlanLimits } from "@/services/billing-service";

async function countActiveApprovedMailboxes(workspaceId: string) {
  const supabase = createAdminSupabaseClient();
  let result = await supabase
    .from("gmail_accounts")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("approval_status", "approved")
    .eq("status", "active");

  if (isMissingColumnResult(result, "gmail_accounts", "approval_status")) {
    result = await supabase
      .from("gmail_accounts")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "active");
  }

  if (result.error) {
    throw result.error;
  }

  return result.count ?? 0;
}

async function countWorkspaceCrmConnections(workspaceId: string) {
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("crm_connections")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "connected", "syncing", "placeholder"]);

  if (result.error) {
    throw result.error;
  }

  return result.count ?? 0;
}

async function countWorkspaceSeedInboxes(workspaceId: string) {
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("seed_inboxes")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("monitoring_enabled", true);

  if (isAnyMissingColumnResult(result, [{ table: "seed_inboxes", column: "monitoring_enabled" }])) {
    const fallback = await supabase
      .from("seed_inboxes")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "active");

    if (fallback.error && !isMissingTableResult(fallback, "seed_inboxes")) {
      throw fallback.error;
    }

    return fallback.count ?? 0;
  }

  if (result.error && !isMissingTableResult(result, "seed_inboxes")) {
    throw result.error;
  }

  return result.count ?? 0;
}

async function countSentMessages(workspaceId: string, sinceIso: string) {
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("outbound_messages")
    .select("id, campaign_contact:campaign_contacts!inner(campaign:campaigns!inner(workspace_id))", {
      count: "exact",
      head: true,
    })
    .eq("campaign_contact.campaign.workspace_id", workspaceId)
    .eq("status", "sent")
    .gte("sent_at", sinceIso);

  if (result.error) {
    throw result.error;
  }

  return result.count ?? 0;
}

async function getWorkspaceUsageSnapshot(workspaceId: string) {
  const supabase = createAdminSupabaseClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const [
    { count: seatCount },
    approvedMailboxCount,
    { count: activeCampaignCount },
    crmConnectionsCount,
    seedInboxesCount,
    dailySendsUsed,
    monthlySendsUsed,
  ] = await Promise.all([
    supabase.from("workspace_members").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    countActiveApprovedMailboxes(workspaceId),
    supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "active"),
    countWorkspaceCrmConnections(workspaceId),
    countWorkspaceSeedInboxes(workspaceId),
    countSentMessages(workspaceId, dayStart),
    countSentMessages(workspaceId, monthStart),
  ]);

  return {
    seats_used: seatCount ?? 0,
    connected_mailboxes_count: approvedMailboxCount,
    active_campaigns_count: activeCampaignCount ?? 0,
    crm_connections_count: crmConnectionsCount,
    seed_inboxes_count: seedInboxesCount,
    daily_sends_used: dailySendsUsed,
    monthly_sends_used: monthlySendsUsed,
  };
}

async function assertWorkspaceStatusAllowsGrowth(workspaceId: string) {
  const billingAccount = await ensureWorkspaceBillingAccount(workspaceId);

  if (["canceled", "past_due", "inactive"].includes(billingAccount.status)) {
    throw new Error("This workspace is not currently allowed to create new resources on its billing status.");
  }

  return billingAccount;
}

export async function refreshWorkspaceUsageCounters(workspaceId: string) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const snapshot = await getWorkspaceUsageSnapshot(workspaceId);

  let result = await (
    supabase.from("workspace_usage_counters") as unknown as {
      upsert: (
        value: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null; data?: unknown }>;
    }
  ).upsert(
    {
      workspace_id: workspaceId,
      ...snapshot,
    },
    { onConflict: "workspace_id,period_start" },
  );

  if (
    result.error &&
    isAnyMissingColumnResult(
      { error: result.error, data: null, status: 400 },
      [
        { table: "workspace_usage_counters", column: "crm_connections_count" },
        { table: "workspace_usage_counters", column: "seed_inboxes_count" },
        { table: "workspace_usage_counters", column: "monthly_sends_used" },
      ],
    )
  ) {
    result = await (
      supabase.from("workspace_usage_counters") as unknown as {
        upsert: (
          value: Record<string, unknown>,
          options?: Record<string, unknown>,
        ) => Promise<{ error: { message: string } | null; data?: unknown }>;
      }
    ).upsert(
      {
        workspace_id: workspaceId,
        seats_used: snapshot.seats_used,
        connected_mailboxes_count: snapshot.connected_mailboxes_count,
        active_campaigns_count: snapshot.active_campaigns_count,
        daily_sends_used: snapshot.daily_sends_used,
      },
      { onConflict: "workspace_id,period_start" },
    );
  }

  if (result.error) {
    throw result.error;
  }

  const billingAccount = await ensureWorkspaceBillingAccount(workspaceId);
  const supabaseBilling = createAdminSupabaseClient();
  await supabaseBilling
    .from("workspace_billing_accounts")
    .update({
      usage_snapshot_jsonb: snapshot,
    })
    .eq("workspace_id", workspaceId)
    .eq("id", billingAccount.id);

  return snapshot;
}

export async function assertWorkspaceCanAddSeat(workspaceId: string) {
  requireSupabaseConfiguration();
  await assertWorkspaceStatusAllowsGrowth(workspaceId);
  const limits = await getWorkspacePlanLimits(workspaceId);
  const snapshot = await refreshWorkspaceUsageCounters(workspaceId);

  if (snapshot.seats_used >= limits.seats_limit) {
    throw new Error("Your current plan has reached the seat limit.");
  }
}

export async function assertWorkspaceCanConnectMailbox(workspaceId: string) {
  requireSupabaseConfiguration();
  await assertWorkspaceStatusAllowsGrowth(workspaceId);
  const limits = await getWorkspacePlanLimits(workspaceId);
  const snapshot = await refreshWorkspaceUsageCounters(workspaceId);

  if (snapshot.connected_mailboxes_count >= limits.connected_mailboxes_limit) {
    throw new Error("Your current plan has reached the approved mailbox limit.");
  }
}

export async function assertWorkspaceCanCreateCampaign(workspaceId: string) {
  requireSupabaseConfiguration();
  await assertWorkspaceStatusAllowsGrowth(workspaceId);
  const limits = await getWorkspacePlanLimits(workspaceId);
  const snapshot = await refreshWorkspaceUsageCounters(workspaceId);

  if (snapshot.active_campaigns_count >= limits.active_campaigns_limit) {
    throw new Error("Your current plan has reached the active campaign limit.");
  }
}

export async function assertWorkspaceCanCreateCrmConnection(workspaceId: string) {
  requireSupabaseConfiguration();
  const billingAccount = await assertWorkspaceStatusAllowsGrowth(workspaceId);
  const limits = await getWorkspacePlanLimits(workspaceId);

  if (!limits.crm_sync_enabled) {
    throw new Error(`CRM sync is not enabled on the ${billingAccount.plan_key} plan.`);
  }

  const snapshot = await refreshWorkspaceUsageCounters(workspaceId);

  if (snapshot.crm_connections_count >= limits.crm_connectors_limit) {
    throw new Error("Your current plan has reached the CRM connector limit.");
  }
}

export async function assertWorkspaceCanCreateSeedInbox(workspaceId: string) {
  requireSupabaseConfiguration();
  await assertWorkspaceStatusAllowsGrowth(workspaceId);
  const limits = await getWorkspacePlanLimits(workspaceId);
  const snapshot = await refreshWorkspaceUsageCounters(workspaceId);

  if (snapshot.seed_inboxes_count >= limits.seed_inboxes_limit) {
    throw new Error("Your current plan has reached the monitored seed inbox limit.");
  }
}

export async function assertWorkspaceCanSendMessages(workspaceId: string, requestedCount = 1) {
  requireSupabaseConfiguration();
  const billingAccount = await ensureWorkspaceBillingAccount(workspaceId);

  if (!["active", "trialing"].includes(billingAccount.status)) {
    throw new Error("Sending is paused because the workspace billing status is not active.");
  }

  const limits = await getWorkspacePlanLimits(workspaceId);
  const snapshot = await refreshWorkspaceUsageCounters(workspaceId);

  if (snapshot.daily_sends_used + requestedCount > limits.daily_sends_limit) {
    throw new Error("The workspace has reached its daily send limit.");
  }

  if (snapshot.monthly_sends_used + requestedCount > limits.monthly_sends_limit) {
    throw new Error("The workspace has reached its monthly send limit.");
  }
}
