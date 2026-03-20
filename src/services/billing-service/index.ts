import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireSupabaseConfiguration } from "@/lib/supabase/env";
import { isAnyMissingColumnResult, isMissingTableResult } from "@/lib/utils/supabase-schema";

export type WorkspacePlanLimits = {
  plan_key: string;
  connected_mailboxes_limit: number;
  daily_sends_limit: number;
  active_campaigns_limit: number;
  seats_limit: number;
  crm_sync_enabled: boolean;
  crm_connectors_limit: number;
  seed_inboxes_limit: number;
  monthly_sends_limit: number;
};

export type WorkspaceBillingAccount = {
  id: string;
  workspace_id: string;
  provider?: string | null;
  provider_customer_id?: string | null;
  status: string;
  plan_key: string;
  assigned_by_user_id?: string | null;
  assigned_at?: string | null;
  renewal_at?: string | null;
  usage_snapshot_jsonb?: Record<string, unknown> | null;
  billing_anchor_at?: string | null;
  canceled_at?: string | null;
  reactivated_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  latest_invoice_status?: string | null;
  billing_metadata_jsonb?: Record<string, unknown> | null;
};

const DEFAULT_PLAN_LIMITS: WorkspacePlanLimits = {
  plan_key: "internal_mvp",
  connected_mailboxes_limit: 5,
  daily_sends_limit: 250,
  active_campaigns_limit: 25,
  seats_limit: 15,
  crm_sync_enabled: true,
  crm_connectors_limit: 3,
  seed_inboxes_limit: 10,
  monthly_sends_limit: 5000,
};

function getPeriodBounds(referenceDate = new Date()) {
  const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 0));
  return {
    currentPeriodStart: start.toISOString().slice(0, 10),
    currentPeriodEnd: end.toISOString().slice(0, 10),
    renewalAt: end.toISOString(),
  };
}

export async function ensureWorkspaceBillingAccount(workspaceId: string, actorUserId?: string | null) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const period = getPeriodBounds();

  const result = await supabase
    .from("workspace_billing_accounts")
    .select(
      "id, workspace_id, provider, provider_customer_id, status, plan_key, assigned_by_user_id, assigned_at, renewal_at, usage_snapshot_jsonb, billing_anchor_at, canceled_at, reactivated_at, current_period_start, current_period_end, cancel_at_period_end, latest_invoice_status, billing_metadata_jsonb",
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (
    isAnyMissingColumnResult(result, [
      { table: "workspace_billing_accounts", column: "plan_key" },
      { table: "workspace_billing_accounts", column: "billing_anchor_at" },
      { table: "workspace_billing_accounts", column: "current_period_start" },
    ])
  ) {
    await (
      supabase.from("workspace_billing_accounts") as unknown as {
        upsert: (
          value: Record<string, unknown>,
          options?: Record<string, unknown>,
        ) => Promise<{ error: { message: string } | null }>;
      }
    ).upsert(
      {
        workspace_id: workspaceId,
        provider: "internal",
        status: "active",
      },
      { onConflict: "workspace_id" },
    );

    return {
      id: workspaceId,
      workspace_id: workspaceId,
      provider: "internal",
      status: "active",
      plan_key: DEFAULT_PLAN_LIMITS.plan_key,
      renewal_at: period.renewalAt,
      current_period_start: period.currentPeriodStart,
      current_period_end: period.currentPeriodEnd,
    } satisfies WorkspaceBillingAccount;
  }

  if (result.error) {
    throw result.error;
  }

  if (result.data) {
    return {
      ...(result.data as WorkspaceBillingAccount),
      plan_key: (result.data as WorkspaceBillingAccount).plan_key ?? DEFAULT_PLAN_LIMITS.plan_key,
    };
  }

  const insertPayload = {
    workspace_id: workspaceId,
    provider: "internal",
    status: "active",
    plan_key: DEFAULT_PLAN_LIMITS.plan_key,
    assigned_by_user_id: actorUserId ?? null,
    assigned_at: new Date().toISOString(),
    renewal_at: period.renewalAt,
    billing_anchor_at: new Date().toISOString(),
    current_period_start: period.currentPeriodStart,
    current_period_end: period.currentPeriodEnd,
    latest_invoice_status: "open",
    usage_snapshot_jsonb: {},
    billing_metadata_jsonb: {},
  };

  const { data, error } = await (
    supabase.from("workspace_billing_accounts") as unknown as {
      upsert: (
        value: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        select: (columns: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
      };
    }
  )
    .upsert(insertPayload, { onConflict: "workspace_id" })
    .select(
      "id, workspace_id, provider, provider_customer_id, status, plan_key, assigned_by_user_id, assigned_at, renewal_at, usage_snapshot_jsonb, billing_anchor_at, canceled_at, reactivated_at, current_period_start, current_period_end, cancel_at_period_end, latest_invoice_status, billing_metadata_jsonb",
    )
    .single();

  if (error) {
    throw error;
  }

  return data as WorkspaceBillingAccount;
}

export async function getWorkspacePlanLimits(workspaceId: string) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const billingAccount = await ensureWorkspaceBillingAccount(workspaceId);

  let result = await supabase
    .from("plan_limits")
    .select(
      "plan_key, connected_mailboxes_limit, daily_sends_limit, active_campaigns_limit, seats_limit, crm_sync_enabled, crm_connectors_limit, seed_inboxes_limit, monthly_sends_limit",
    )
    .eq("plan_key", billingAccount.plan_key)
    .maybeSingle();

  if (
    isAnyMissingColumnResult(result, [
      { table: "plan_limits", column: "crm_connectors_limit" },
      { table: "plan_limits", column: "seed_inboxes_limit" },
      { table: "plan_limits", column: "monthly_sends_limit" },
    ])
  ) {
    result = await supabase
      .from("plan_limits")
      .select("plan_key, connected_mailboxes_limit, daily_sends_limit, active_campaigns_limit, seats_limit, crm_sync_enabled")
      .eq("plan_key", billingAccount.plan_key)
      .maybeSingle();
  }

  if (result.error) {
    throw result.error;
  }

  return {
    ...DEFAULT_PLAN_LIMITS,
    ...(result.data as Partial<WorkspacePlanLimits> | null),
    plan_key: (result.data as Partial<WorkspacePlanLimits> | null)?.plan_key ?? billingAccount.plan_key,
  } satisfies WorkspacePlanLimits;
}

export async function recordBillingEvent(input: {
  workspaceId: string;
  actorUserId?: string | null;
  eventType: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const result = await supabase.from("workspace_billing_events").insert({
    workspace_id: input.workspaceId,
    actor_user_id: input.actorUserId ?? null,
    event_type: input.eventType,
    summary: input.summary,
    metadata: input.metadata ?? {},
  });

  if (isMissingTableResult(result, "workspace_billing_events")) {
    return;
  }

  if (result.error) {
    throw result.error;
  }
}

export async function createBillingInvoiceSnapshot(input: {
  workspaceId: string;
  actorUserId?: string | null;
  usageSnapshot?: Record<string, unknown>;
}) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const billingAccount = await ensureWorkspaceBillingAccount(input.workspaceId, input.actorUserId);
  const period = getPeriodBounds();
  const invoiceNumber = `INT-${period.currentPeriodStart.replace(/-/g, "")}-${input.workspaceId.slice(0, 8).toUpperCase()}`;

  const result = await (
    supabase.from("workspace_billing_invoices") as unknown as {
      upsert: (
        value: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert(
    {
      workspace_id: input.workspaceId,
      billing_account_id: billingAccount.id,
      invoice_number: invoiceNumber,
      status: billingAccount.status === "active" ? "open" : "draft",
      plan_key: billingAccount.plan_key,
      period_start: billingAccount.current_period_start ?? period.currentPeriodStart,
      period_end: billingAccount.current_period_end ?? period.currentPeriodEnd,
      usage_snapshot_jsonb: input.usageSnapshot ?? billingAccount.usage_snapshot_jsonb ?? {},
    },
    { onConflict: "workspace_id,invoice_number" },
  );

  if (isMissingTableResult(result, "workspace_billing_invoices")) {
    return;
  }

  if (result.error) {
    throw result.error;
  }
}

export async function updateWorkspaceBillingAccount(input: {
  workspaceId: string;
  actorUserId: string;
  planKey: string;
  status: string;
  renewalAt?: string | null;
  usageSnapshot?: Record<string, unknown> | null;
}) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const period = getPeriodBounds();
  const existing = await ensureWorkspaceBillingAccount(input.workspaceId, input.actorUserId);
  const isReactivated = existing.status === "canceled" && input.status !== "canceled";
  const isCanceled = input.status === "canceled";

  const payload = {
    workspace_id: input.workspaceId,
    provider: "internal",
    status: input.status,
    plan_key: input.planKey,
    assigned_by_user_id: input.actorUserId,
    assigned_at: now,
    renewal_at: input.renewalAt?.trim() || period.renewalAt,
    billing_anchor_at: existing.billing_anchor_at ?? now,
    current_period_start: existing.current_period_start ?? period.currentPeriodStart,
    current_period_end: existing.current_period_end ?? period.currentPeriodEnd,
    canceled_at: isCanceled ? now : null,
    reactivated_at: isReactivated ? now : existing.reactivated_at ?? null,
    cancel_at_period_end: false,
    latest_invoice_status: input.status === "past_due" ? "open" : input.status === "canceled" ? "void" : "open",
    usage_snapshot_jsonb: input.usageSnapshot ?? existing.usage_snapshot_jsonb ?? {},
    billing_metadata_jsonb: existing.billing_metadata_jsonb ?? {},
  };

  const { error } = await (
    supabase.from("workspace_billing_accounts") as unknown as {
      upsert: (
        value: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert(payload, { onConflict: "workspace_id" });

  if (error) {
    throw error;
  }

  await recordBillingEvent({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    eventType: "billing.updated",
    summary: `Billing moved to ${input.status} on ${input.planKey}.`,
    metadata: {
      previousStatus: existing.status,
      status: input.status,
      planKey: input.planKey,
    },
  });
  await createBillingInvoiceSnapshot({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    usageSnapshot: input.usageSnapshot ?? existing.usage_snapshot_jsonb ?? {},
  });

  return ensureWorkspaceBillingAccount(input.workspaceId, input.actorUserId);
}

export async function getWorkspaceBillingTimeline(workspaceId: string) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();

  const [events, invoices] = await Promise.all([
    supabase
      .from("workspace_billing_events")
      .select("id, event_type, summary, metadata, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("workspace_billing_invoices")
      .select("id, invoice_number, status, plan_key, period_start, period_end, usage_snapshot_jsonb, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  return {
    events: isMissingTableResult(events, "workspace_billing_events")
      ? []
      : ((events.data ?? []) as Array<{
          id: string;
          event_type: string;
          summary: string;
          metadata: Record<string, unknown> | null;
          created_at: string;
        }>),
    invoices: isMissingTableResult(invoices, "workspace_billing_invoices")
      ? []
      : ((invoices.data ?? []) as Array<{
          id: string;
          invoice_number: string;
          status: string;
          plan_key: string;
          period_start: string;
          period_end: string;
          usage_snapshot_jsonb: Record<string, unknown> | null;
          created_at: string;
        }>),
  };
}
