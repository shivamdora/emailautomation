import "server-only";
import { listWorkspaceMembers } from "@/lib/db/workspace";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  env,
  isGoogleConfigured,
  isHubSpotConfigured,
  isSalesforceConfigured,
  isSupabaseConfigured,
  requireSupabaseConfiguration,
} from "@/lib/supabase/env";
import { isAnyMissingColumnResult } from "@/lib/utils/supabase-schema";
import { getWorkspaceBillingTimeline, getWorkspacePlanLimits } from "@/services/billing-service";
import { getCampaignSendQueueHealth } from "@/services/campaign-send-queue-service";
import { listWorkspaceCrmConnections } from "@/services/crm-service";
import { getWorkspaceGmailAccounts } from "@/services/gmail-service";
import { getWorkspaceSeedMonitorSummary } from "@/services/seed-monitor-service";

export async function getWorkspaceAdminSummary(workspaceId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const sendQueueHealthPromise = getCampaignSendQueueHealth(workspaceId).catch(() => ({
    oldestPendingDueAt: null,
    failedJobCount: 0,
    pendingJobCount: 0,
    lastSuccessfulRun: null,
  }));
  const [members, gmailAccounts, usageCounter, billingTimeline, planLimits, seedMonitorSummary, sendQueueHealth] = await Promise.all([
    listWorkspaceMembers(workspaceId),
    getWorkspaceGmailAccounts(workspaceId),
    supabase
      .from("workspace_usage_counters")
      .select("daily_sends_used, active_campaigns_count, connected_mailboxes_count, seats_used, period_start, crm_connections_count, seed_inboxes_count, monthly_sends_used")
      .eq("workspace_id", workspaceId)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getWorkspaceBillingTimeline(workspaceId),
    getWorkspacePlanLimits(workspaceId),
    getWorkspaceSeedMonitorSummary(workspaceId),
    sendQueueHealthPromise,
  ]);

  let billingAccount = await supabase
    .from("workspace_billing_accounts")
    .select("id, provider, provider_customer_id, status, plan_key, assigned_at, renewal_at, usage_snapshot_jsonb")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (
    isAnyMissingColumnResult(billingAccount, [
      { table: "workspace_billing_accounts", column: "plan_key" },
      { table: "workspace_billing_accounts", column: "assigned_at" },
      { table: "workspace_billing_accounts", column: "renewal_at" },
      { table: "workspace_billing_accounts", column: "usage_snapshot_jsonb" },
    ])
  ) {
    billingAccount = await supabase
      .from("workspace_billing_accounts")
      .select("id, provider, provider_customer_id, status")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
  }

  const crmConnections = await listWorkspaceCrmConnections(workspaceId);
  const seedInboxes = seedMonitorSummary.seedInboxes;

  return {
    members,
    gmailAccounts,
    billingAccount: billingAccount.data as
      | {
          id: string;
          provider?: string | null;
          provider_customer_id?: string | null;
          status: string;
          plan_key?: string | null;
          assigned_at?: string | null;
          renewal_at?: string | null;
          usage_snapshot_jsonb?: Record<string, unknown> | null;
        }
      | null,
    usageCounter: usageCounter.data as
      | {
          daily_sends_used: number;
          active_campaigns_count: number;
          connected_mailboxes_count: number;
          seats_used: number;
          period_start: string;
          crm_connections_count?: number;
          seed_inboxes_count?: number;
          monthly_sends_used?: number;
        }
      | null,
    planLimits,
    billingTimeline,
    crmConnections: crmConnections as Array<{
      id: string;
      provider: string;
      status: string;
      auth_type?: string | null;
      provider_account_label?: string | null;
      provider_account_email?: string | null;
      inbound_api_key_hint?: string | null;
      outbound_webhook_url?: string | null;
      last_synced_at?: string | null;
      last_writeback_at?: string | null;
      last_error?: string | null;
    }>,
    seedInboxes: seedInboxes as Array<{
      id: string;
      provider: string;
      email_address: string;
      status: string;
      connection_status?: string | null;
      health_status?: string | null;
      last_checked_at?: string | null;
      last_probe_at?: string | null;
      last_result_status?: string | null;
      last_error?: string | null;
    }>,
    seedResults: seedMonitorSummary.recentResults as Array<{
      id: string;
      seed_inbox_id: string;
      placement_status: string;
      observed_at: string;
      probe_key: string;
    }>,
    sendQueueHealth,
  };
}

export function getWorkspaceHealthSummary() {
  return [
    {
      key: "supabase",
      label: "Supabase",
      status: isSupabaseConfigured ? "healthy" : "error",
      summary: isSupabaseConfigured ? "Configured and ready." : "Supabase keys are missing or placeholders.",
    },
    {
      key: "google",
      label: "Google OAuth",
      status: isGoogleConfigured ? "healthy" : "warning",
      summary: isGoogleConfigured ? "Mailbox OAuth is configured." : "Mailbox OAuth is not fully configured yet.",
    },
    {
      key: "hubspot",
      label: "HubSpot OAuth",
      status: isHubSpotConfigured ? "healthy" : "warning",
      summary: isHubSpotConfigured ? "HubSpot CRM connect is configured." : "HubSpot OAuth keys are missing.",
    },
    {
      key: "salesforce",
      label: "Salesforce OAuth",
      status: isSalesforceConfigured ? "healthy" : "warning",
      summary: isSalesforceConfigured ? "Salesforce CRM connect is configured." : "Salesforce OAuth keys are missing.",
    },
    {
      key: "shared-workspace",
      label: "Shared workspace",
      status: env.SHARED_WORKSPACE_SLUG ? "healthy" : "warning",
      summary: env.SHARED_WORKSPACE_SLUG
        ? `Auto-join is enabled for ${env.SHARED_WORKSPACE_SLUG}.`
        : "Shared workspace auto-join is not configured.",
    },
    {
      key: "cron",
      label: "Cron secret",
      status: env.SUPABASE_CRON_VERIFY_SECRET ? "healthy" : "warning",
      summary: env.SUPABASE_CRON_VERIFY_SECRET
        ? "Scheduled jobs can verify cron calls."
        : "Cron verification secret is missing.",
    },
    {
      key: "seed-monitor",
      label: "Seed monitor cadence",
      status: env.SEED_MONITOR_INTERVAL_MINUTES ? "healthy" : "warning",
      summary: `Seed inbox probes run every ${env.SEED_MONITOR_INTERVAL_MINUTES} minutes when the monitor function is deployed.`,
    },
  ] as const;
}
