import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Cable,
  CreditCard,
  Gauge,
  HeartPulse,
  MailSearch,
  RefreshCcw,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiquidSelect } from "@/components/ui/liquid-select";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { getWorkspaceAdminSummary, getWorkspaceHealthSummary } from "@/services/admin-service";

type AdvancedSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function HealthBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "healthy" ? "success" : status === "warning" ? "neutral" : "danger"}>
      {status}
    </Badge>
  );
}

function getBanner(params: Record<string, string | string[] | undefined>) {
  const status = typeof params.status === "string" ? params.status : null;
  const workspaceMessage =
    typeof params.workspaceMessage === "string" ? decodeURIComponent(params.workspaceMessage) : null;
  const seedInbox = typeof params.seedInbox === "string" ? params.seedInbox : null;
  const rawMessage = typeof params.message === "string" ? params.message : null;
  const message = rawMessage ? decodeURIComponent(rawMessage) : null;

  if (status === "workspace-switched") {
    return { tone: "success" as const, text: "Workspace switched successfully." };
  }

  if (workspaceMessage) {
    return { tone: "error" as const, text: workspaceMessage };
  }

  if (seedInbox === "connected") {
    return { tone: "success" as const, text: "Seed inbox monitor connected successfully." };
  }

  if (seedInbox === "missing-code") {
    return {
      tone: "error" as const,
      text: "The seed inbox callback did not include a valid authorization code.",
    };
  }

  if (seedInbox === "error") {
    return { tone: "error" as const, text: message || "Seed inbox connection failed." };
  }

  return null;
}

export default async function SettingsAdvancedPage({
  searchParams,
}: AdvancedSettingsPageProps) {
  const workspace = await getWorkspaceContext();
  const params = (await searchParams) ?? {};
  const canManage = ["owner", "admin"].includes(workspace.workspaceRole);
  const banner = getBanner(params);
  const [adminSummary, healthSummary] = await Promise.all([
    getWorkspaceAdminSummary(workspace.workspaceId),
    Promise.resolve(getWorkspaceHealthSummary()),
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={workspace.workspaceName}
        title="Advanced"
        description="Billing state, workspace switching, diagnostics, and seed monitoring live here so the main settings flow stays focused on setup and sending."
      />

      {banner ? (
        <div
          className={
            banner.tone === "error"
              ? "rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
              : "rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700"
          }
        >
          {banner.text}
        </div>
      ) : null}

      {!canManage ? (
        <div className="rounded-2xl border border-white/70 bg-white/72 px-4 py-4 text-sm text-muted-foreground">
          Advanced settings are visible in read-only mode. Owner or admin access is required for workspace switching, billing state, diagnostics actions, and seed monitor operations.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-white/74 bg-white/84 text-foreground">
                <BadgeCheck className="size-5" />
              </span>
              <div className="space-y-1">
                <CardTitle>Workspace access</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Switching workspaces is rare admin work, so it belongs here instead of the daily settings path.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {workspace.availableWorkspaces.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-white/65 bg-white/60 px-4 py-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.kind} / {item.role}
                  </p>
                </div>
                {item.id === workspace.workspaceId ? (
                  <Badge variant="success">Active workspace</Badge>
                ) : canManage ? (
                  <form action="/api/workspace/active" method="post">
                    <input type="hidden" name="workspaceId" value={item.id} />
                    <Button size="sm" type="submit" variant="outline">
                      Switch workspace
                    </Button>
                  </form>
                ) : (
                  <Badge variant="neutral">Available</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-white/74 bg-[rgba(215,237,247,0.84)] text-accent-foreground">
                <CreditCard className="size-5" />
              </span>
              <div className="space-y-1">
                <CardTitle>Plan and usage</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Internal billing state, plan limits, and usage counters are still available, just moved out of the everyday path.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {canManage ? (
              <form
                action="/api/settings/billing"
                method="post"
                className="grid gap-3 rounded-[1.35rem] border border-white/70 bg-white/60 px-4 py-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Assign internal plan</p>
                  <p className="text-sm text-muted-foreground">
                    Update workspace entitlements without exposing billing controls on the main settings page.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    type="text"
                    name="planKey"
                    defaultValue={adminSummary.billingAccount?.plan_key ?? "internal_mvp"}
                    className="glass-control h-11 rounded-[1rem] border-0 px-4 text-sm shadow-none"
                  />
                  <LiquidSelect
                    name="status"
                    defaultValue={adminSummary.billingAccount?.status ?? "active"}
                    ariaLabel="Billing status"
                    triggerClassName="h-11 rounded-[1rem]"
                    options={[
                      { value: "trialing", label: "Trialing", description: "Trial access is active" },
                      { value: "active", label: "Active", description: "Workspace can send normally" },
                      { value: "past_due", label: "Past due", description: "Billing follow-up required" },
                      { value: "canceled", label: "Canceled", description: "Workspace is no longer active" },
                    ]}
                  />
                  <input
                    type="datetime-local"
                    name="renewalAt"
                    defaultValue={
                      adminSummary.billingAccount?.renewal_at
                        ? new Date(adminSummary.billingAccount.renewal_at).toISOString().slice(0, 16)
                        : ""
                    }
                    className="glass-control h-11 rounded-[1rem] border-0 px-4 text-sm shadow-none"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm">
                    Save billing state
                  </Button>
                </div>
              </form>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Billing status</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {(adminSummary.billingAccount?.status ?? "inactive").replace(/_/g, " ")}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Renewal</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {formatDate(adminSummary.billingAccount?.renewal_at)}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Members</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {(adminSummary.usageCounter?.seats_used ?? 0)} / {adminSummary.planLimits.seats_limit}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Mailboxes</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {(adminSummary.usageCounter?.connected_mailboxes_count ?? 0)} / {adminSummary.planLimits.connected_mailboxes_limit}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Campaigns</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {(adminSummary.usageCounter?.active_campaigns_count ?? 0)} / {adminSummary.planLimits.active_campaigns_limit}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Daily sends</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {(adminSummary.usageCounter?.daily_sends_used ?? 0)} / {adminSummary.planLimits.daily_sends_limit}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-3 md:col-span-2 xl:col-span-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Monthly sends</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {(adminSummary.usageCounter?.monthly_sends_used ?? 0)} / {adminSummary.planLimits.monthly_sends_limit}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-4">
                <p className="text-sm font-semibold text-foreground">Recent billing events</p>
                <div className="mt-3 grid gap-2">
                  {adminSummary.billingTimeline.events.length ? (
                    adminSummary.billingTimeline.events.map((event) => (
                      <div key={event.id} className="rounded-[1rem] border border-white/60 bg-white/74 px-3 py-3">
                        <p className="text-sm font-medium text-foreground">{event.summary}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.created_at)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No billing events yet.</p>
                  )}
                </div>
              </div>
              <div className="rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-4">
                <p className="text-sm font-semibold text-foreground">Invoice snapshots</p>
                <div className="mt-3 grid gap-2">
                  {adminSummary.billingTimeline.invoices.length ? (
                    adminSummary.billingTimeline.invoices.map((invoice) => (
                      <div key={invoice.id} className="rounded-[1rem] border border-white/60 bg-white/74 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">{invoice.invoice_number}</p>
                          <Badge variant="neutral">{invoice.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {invoice.plan_key} · {invoice.period_start} to {invoice.period_end}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No invoice snapshots yet.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-white/74 bg-white/84 text-foreground">
                <HeartPulse className="size-5" />
              </span>
              <div className="space-y-1">
                <CardTitle>Workspace diagnostics</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Health checks stay visible here for admins without forcing end users to parse technical state on the main settings page.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {healthSummary.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-white/65 bg-white/58 px-4 py-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.summary}</p>
                </div>
                <HealthBadge status={item.status} />
              </div>
            ))}
            <div className="grid gap-3 pt-1 md:grid-cols-3">
              <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Queue worker</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {formatDate(adminSummary.sendQueueHealth.lastSuccessfulRun?.finished_at)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last successful `send-due-messages` run.
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Oldest due job</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {formatDate(adminSummary.sendQueueHealth.oldestPendingDueAt)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Earliest pending send waiting to be processed.
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Queue failures</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {adminSummary.sendQueueHealth.failedJobCount}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pending jobs: {adminSummary.sendQueueHealth.pendingJobCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-white/74 bg-[rgba(215,237,247,0.84)] text-accent-foreground">
                <MailSearch className="size-5" />
              </span>
              <div className="space-y-1">
                <CardTitle>Seed inbox monitors</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Placement monitoring belongs in Advanced with the rest of the operational tooling.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {canManage ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href="/api/settings/seed-inboxes/connect">Connect Gmail monitor</Link>
                  </Button>
                  <form action="/api/settings/seed-inboxes/probe" method="post">
                    <Button size="sm" type="submit" variant="secondary">
                      <RefreshCcw className="size-4" />
                      Queue placement probes
                    </Button>
                  </form>
                </div>
                <form
                  action="/api/settings/seed-inboxes"
                  method="post"
                  className="grid gap-3 rounded-[1.35rem] border border-white/70 bg-white/60 px-4 py-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Register a monitor manually</p>
                    <p className="text-sm text-muted-foreground">
                      Use this for non-Gmail or not-yet-authorized inboxes that still need monitoring coverage.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <LiquidSelect
                      name="provider"
                      defaultValue="gmail"
                      ariaLabel="Seed inbox provider"
                      triggerClassName="h-11 rounded-[1rem]"
                      options={[
                        { value: "gmail", label: "Gmail", description: "Google Workspace or Gmail" },
                        { value: "outlook", label: "Outlook", description: "Microsoft 365 or Outlook" },
                        { value: "yahoo", label: "Yahoo", description: "Yahoo Mail inboxes" },
                        { value: "other", label: "Other", description: "Any other provider" },
                      ]}
                    />
                    <input
                      type="email"
                      name="emailAddress"
                      placeholder="seed@yourdomain.com"
                      className="glass-control h-11 rounded-[1rem] border-0 px-4 text-sm shadow-none md:col-span-2"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" type="submit">
                      Save monitor
                    </Button>
                  </div>
                </form>
              </>
            ) : null}

            {adminSummary.seedInboxes.length ? (
              adminSummary.seedInboxes.map((inbox) => (
                <div
                  key={inbox.id}
                  className="rounded-[1.35rem] border border-white/65 bg-white/58 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{inbox.email_address}</p>
                      <p className="text-sm text-muted-foreground">
                        {inbox.provider} / {inbox.status}
                        {inbox.connection_status ? ` / ${inbox.connection_status}` : ""}
                      </p>
                    </div>
                    <HealthBadge
                      status={
                        inbox.last_error
                          ? "error"
                          : inbox.health_status === "healthy"
                            ? "healthy"
                            : "warning"
                      }
                    />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[1.1rem] border border-white/60 bg-white/74 px-3 py-3 text-sm">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Last probe</p>
                      <p className="mt-2 text-foreground">{formatDate(inbox.last_probe_at)}</p>
                    </div>
                    <div className="rounded-[1.1rem] border border-white/60 bg-white/74 px-3 py-3 text-sm">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Last check</p>
                      <p className="mt-2 text-foreground">{formatDate(inbox.last_checked_at)}</p>
                    </div>
                    <div className="rounded-[1.1rem] border border-white/60 bg-white/74 px-3 py-3 text-sm">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Latest result</p>
                      <p className="mt-2 text-foreground">{inbox.last_result_status ?? "No result yet"}</p>
                    </div>
                  </div>

                  {inbox.last_error ? (
                    <div className="mt-4 rounded-[1.1rem] border border-danger/35 bg-danger/8 px-3 py-3 text-sm text-danger">
                      {inbox.last_error}
                    </div>
                  ) : null}

                  {canManage ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <form action="/api/settings/seed-inboxes" method="post">
                        <input type="hidden" name="seedInboxId" value={inbox.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={inbox.status === "paused" ? "active" : "paused"}
                        />
                        <Button size="sm" type="submit" variant="outline">
                          {inbox.status === "paused" ? "Resume monitor" : "Pause monitor"}
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-background/70 px-4 py-8 text-sm text-muted-foreground">
                No seed inbox monitors are configured yet.
              </div>
            )}

            <div className="rounded-[1.35rem] border border-white/65 bg-white/58 px-4 py-4">
              <div className="flex items-center gap-2">
                <Gauge className="size-4 text-accent-foreground" />
                <p className="text-sm font-semibold text-foreground">Recent placement observations</p>
              </div>
              <div className="mt-3 grid gap-2">
                {adminSummary.seedResults.length ? (
                  adminSummary.seedResults.map((result) => (
                    <div key={result.id} className="rounded-[1rem] border border-white/60 bg-white/74 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{result.placement_status}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(result.observed_at)}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{result.probe_key}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No placement observations recorded yet.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-white/74 bg-white/84 text-foreground">
              <Activity className="size-5" />
            </span>
            <div className="space-y-1">
              <CardTitle>Why these controls are here</CardTitle>
              <p className="text-sm text-muted-foreground">
                Advanced is where rare admin work belongs: visible when needed, invisible when you are just trying to send.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-4">
            <Badge variant="neutral">
              <AlertTriangle className="size-4" />
              Isolate risk
            </Badge>
            <p className="mt-3 text-sm font-semibold text-foreground">Diagnostics should not distract campaign operators</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Most users only need sending, project identity, and integrations. Everything else stays here.
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-4">
            <Badge variant="neutral">
              <CreditCard className="size-4" />
              Keep billing internal
            </Badge>
            <p className="mt-3 text-sm font-semibold text-foreground">Plan state stays available for operators without becoming the headline</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The overview should help people get ready to send, not ask them to interpret internal billing details.
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-4">
            <Badge variant="neutral">
              <Cable className="size-4" />
              Separate ops
            </Badge>
            <p className="mt-3 text-sm font-semibold text-foreground">Monitoring and sync tooling should be grouped with admin actions</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              When issues happen, the owner knows exactly where to go without exposing these controls to everyone else.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
