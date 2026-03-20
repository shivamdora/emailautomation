import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { getWorkspaceAdminSummary, getWorkspaceHealthSummary } from "@/services/admin-service";

function HealthBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "healthy" ? "success" : status === "warning" ? "neutral" : "danger"}>
      {status}
    </Badge>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await getWorkspaceContext();
  const params = searchParams ? await searchParams : {};
  const adminSummary = await getWorkspaceAdminSummary(workspace.workspaceId);
  const healthSummary = getWorkspaceHealthSummary();
  const canManage = ["owner", "admin"].includes(workspace.workspaceRole);
  const latestCrmKey = typeof params.crmKey === "string" ? params.crmKey : null;
  const latestWebhookSecret =
    typeof params.crmWebhookSecret === "string" ? params.crmWebhookSecret : null;

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Operations console"
        title={workspace.workspaceName}
        description="Manage entitlements, approved senders, CRM sync, and Gmail seed placement telemetry from one production-ready control surface."
      />

      {latestCrmKey || latestWebhookSecret ? (
        <Card className="border-amber-200 bg-amber-50/80">
          <CardHeader>
            <CardTitle>New Custom CRM credentials</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-700">
            <p>Copy these now. They are only shown once after creation or key rotation.</p>
            {latestCrmKey ? (
              <div className="rounded-[1rem] bg-white px-4 py-3 font-mono text-xs">{latestCrmKey}</div>
            ) : null}
            {latestWebhookSecret ? (
              <div className="rounded-[1rem] bg-white px-4 py-3 font-mono text-xs">{latestWebhookSecret}</div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{adminSummary.members.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Approved senders</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {adminSummary.gmailAccounts.filter((account) => account.approval_status === "approved").length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>CRM connections</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{adminSummary.crmConnections.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Seed monitors</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{adminSummary.seedInboxes.length}</CardContent>
        </Card>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workspace health</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {healthSummary.map((item) => (
              <div key={item.key} className="glass-control flex items-center justify-between rounded-[1.25rem] px-4 py-3">
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.summary}</p>
                </div>
                <HealthBadge status={item.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan and usage</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {canManage ? (
              <form action="/api/settings/billing" method="post" className="glass-control grid gap-3 rounded-[1.25rem] px-4 py-4">
                <div className="grid gap-1">
                  <p className="font-medium">Assign internal plan</p>
                  <p className="text-muted-foreground">Update production entitlements without public checkout.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    type="text"
                    name="planKey"
                    defaultValue={adminSummary.billingAccount?.plan_key ?? "internal_mvp"}
                    className="glass-control h-11 rounded-[1rem] border-0 px-4 text-sm shadow-none"
                  />
                  <select
                    name="status"
                    defaultValue={adminSummary.billingAccount?.status ?? "active"}
                    className="glass-control h-11 rounded-[1rem] border-0 px-4 text-sm shadow-none"
                  >
                    <option value="trialing">trialing</option>
                    <option value="active">active</option>
                    <option value="past_due">past_due</option>
                    <option value="canceled">canceled</option>
                  </select>
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
                  <Button type="submit" size="sm">Save billing state</Button>
                </div>
              </form>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="glass-control rounded-[1.25rem] px-4 py-3">
                <p className="font-medium">Billing status</p>
                <p className="mt-1 text-muted-foreground">
                  {(adminSummary.billingAccount?.status ?? "inactive").replace(/_/g, " ")}
                </p>
              </div>
              <div className="glass-control rounded-[1.25rem] px-4 py-3">
                <p className="font-medium">Renewal</p>
                <p className="mt-1 text-muted-foreground">{formatDate(adminSummary.billingAccount?.renewal_at)}</p>
              </div>
              <div className="glass-control rounded-[1.25rem] px-4 py-3">
                <p className="font-medium">Seats</p>
                <p className="mt-1 text-muted-foreground">
                  {(adminSummary.usageCounter?.seats_used ?? 0)} / {adminSummary.planLimits.seats_limit}
                </p>
              </div>
              <div className="glass-control rounded-[1.25rem] px-4 py-3">
                <p className="font-medium">Approved mailboxes</p>
                <p className="mt-1 text-muted-foreground">
                  {(adminSummary.usageCounter?.connected_mailboxes_count ?? 0)} / {adminSummary.planLimits.connected_mailboxes_limit}
                </p>
              </div>
              <div className="glass-control rounded-[1.25rem] px-4 py-3">
                <p className="font-medium">Active campaigns</p>
                <p className="mt-1 text-muted-foreground">
                  {(adminSummary.usageCounter?.active_campaigns_count ?? 0)} / {adminSummary.planLimits.active_campaigns_limit}
                </p>
              </div>
              <div className="glass-control rounded-[1.25rem] px-4 py-3">
                <p className="font-medium">CRM connectors</p>
                <p className="mt-1 text-muted-foreground">
                  {(adminSummary.usageCounter?.crm_connections_count ?? 0)} / {adminSummary.planLimits.crm_connectors_limit}
                </p>
              </div>
              <div className="glass-control rounded-[1.25rem] px-4 py-3">
                <p className="font-medium">Seed monitors</p>
                <p className="mt-1 text-muted-foreground">
                  {(adminSummary.usageCounter?.seed_inboxes_count ?? 0)} / {adminSummary.planLimits.seed_inboxes_limit}
                </p>
              </div>
              <div className="glass-control rounded-[1.25rem] px-4 py-3">
                <p className="font-medium">Daily sends</p>
                <p className="mt-1 text-muted-foreground">
                  {(adminSummary.usageCounter?.daily_sends_used ?? 0)} / {adminSummary.planLimits.daily_sends_limit}
                </p>
              </div>
              <div className="glass-control rounded-[1.25rem] px-4 py-3 md:col-span-2">
                <p className="font-medium">Monthly sends</p>
                <p className="mt-1 text-muted-foreground">
                  {(adminSummary.usageCounter?.monthly_sends_used ?? 0)} / {adminSummary.planLimits.monthly_sends_limit}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="glass-control rounded-[1.25rem] px-4 py-4">
                <p className="font-medium">Recent billing events</p>
                <div className="mt-3 grid gap-2">
                  {adminSummary.billingTimeline.events.length ? (
                    adminSummary.billingTimeline.events.map((event) => (
                      <div key={event.id} className="rounded-[1rem] bg-white/70 px-3 py-2">
                        <p className="font-medium">{event.summary}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(event.created_at)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No billing events yet.</p>
                  )}
                </div>
              </div>
              <div className="glass-control rounded-[1.25rem] px-4 py-4">
                <p className="font-medium">Invoice snapshots</p>
                <div className="mt-3 grid gap-2">
                  {adminSummary.billingTimeline.invoices.length ? (
                    adminSummary.billingTimeline.invoices.map((invoice) => (
                      <div key={invoice.id} className="rounded-[1rem] bg-white/70 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{invoice.invoice_number}</p>
                          <Badge variant="neutral">{invoice.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {invoice.plan_key} · {invoice.period_start} to {invoice.period_end}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No invoice snapshots yet.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Team members</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {adminSummary.members.map((member) => (
              <div key={member.id} className="glass-control flex items-center justify-between rounded-[1.25rem] px-4 py-3">
                <div>
                  <p className="font-medium">{member.fullName}</p>
                  <p className="text-sm text-muted-foreground">{member.title ?? "No title set"}</p>
                </div>
                <Badge variant="neutral">{member.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sender approvals</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {adminSummary.gmailAccounts.length ? (
              adminSummary.gmailAccounts.map((account) => (
                <div key={account.id} className="glass-control grid gap-3 rounded-[1.25rem] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{account.email_address}</p>
                      <p className="text-sm text-muted-foreground">
                        {account.approval_status ?? "pending"} / {account.health_status ?? "unknown"}
                      </p>
                    </div>
                    <HealthBadge
                      status={
                        account.approval_status === "approved"
                          ? "healthy"
                          : account.approval_status === "rejected"
                            ? "error"
                            : "warning"
                      }
                    />
                  </div>
                  {canManage && account.approval_status !== "approved" ? (
                    <div className="flex flex-wrap gap-2">
                      <form action="/api/gmail/approve" method="post">
                        <input type="hidden" name="gmailAccountId" value={account.id} />
                        <input type="hidden" name="approvalStatus" value="approved" />
                        <Button size="sm" type="submit">Approve sender</Button>
                      </form>
                      <form action="/api/gmail/approve" method="post">
                        <input type="hidden" name="gmailAccountId" value={account.id} />
                        <input type="hidden" name="approvalStatus" value="rejected" />
                        <Button size="sm" type="submit" variant="outline">Reject</Button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="glass-control rounded-[1.25rem] px-4 py-5 text-sm text-muted-foreground">
                No senders connected yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CRM connections</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {canManage ? (
              <>
                <div className="glass-control grid gap-3 rounded-[1.25rem] px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href="/api/crm/connect/hubspot">Connect HubSpot</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/api/crm/connect/salesforce">Connect Salesforce</Link>
                    </Button>
                    <form action="/api/crm/sync" method="post">
                      <Button size="sm" type="submit" variant="secondary">Run CRM sync</Button>
                    </form>
                  </div>
                </div>

                <form action="/api/settings/crm/custom" method="post" className="glass-control grid gap-3 rounded-[1.25rem] px-4 py-4">
                  <div className="grid gap-1">
                    <p className="font-medium">Create Custom CRM connection</p>
                    <p className="text-sm text-muted-foreground">
                      Generates a managed inbound API key and optional outbound webhook signing secret.
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <input
                      type="text"
                      name="providerAccountLabel"
                      placeholder="Acme internal CRM"
                      className="glass-control h-11 rounded-[1rem] border-0 px-4 text-sm shadow-none"
                    />
                    <input
                      type="url"
                      name="outboundWebhookUrl"
                      placeholder="https://crm.example.com/outboundflow/events"
                      className="glass-control h-11 rounded-[1rem] border-0 px-4 text-sm shadow-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" type="submit">Create Custom CRM</Button>
                  </div>
                </form>
              </>
            ) : null}

            {adminSummary.crmConnections.length ? (
              adminSummary.crmConnections.map((connection) => (
                <div key={connection.id} className="glass-control grid gap-3 rounded-[1.25rem] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{connection.provider_account_label ?? connection.provider}</p>
                      <p className="text-sm text-muted-foreground">
                        {connection.provider} / {connection.status}
                        {connection.provider_account_email ? ` / ${connection.provider_account_email}` : ""}
                      </p>
                    </div>
                    <HealthBadge status={connection.last_error ? "error" : connection.last_synced_at ? "healthy" : "warning"} />
                  </div>
                  <div className="grid gap-1 text-xs text-muted-foreground">
                    <p>Last sync: {formatDate(connection.last_synced_at)}</p>
                    <p>Last writeback: {formatDate(connection.last_writeback_at)}</p>
                    {connection.inbound_api_key_hint ? <p>Key hint: ending in {connection.inbound_api_key_hint}</p> : null}
                    {connection.outbound_webhook_url ? <p>Webhook: {connection.outbound_webhook_url}</p> : null}
                    {connection.last_error ? <p className="text-danger">{connection.last_error}</p> : null}
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <form action="/api/crm/sync" method="post">
                        <input type="hidden" name="connectionId" value={connection.id} />
                        <Button size="sm" type="submit" variant="secondary">Sync now</Button>
                      </form>
                      <form action="/api/crm/disconnect" method="post">
                        <input type="hidden" name="connectionId" value={connection.id} />
                        <Button size="sm" type="submit" variant="outline">Disconnect</Button>
                      </form>
                      {connection.provider === "custom_crm" ? (
                        <form action="/api/settings/crm/custom" method="post">
                          <input type="hidden" name="action" value="rotate_key" />
                          <input type="hidden" name="connectionId" value={connection.id} />
                          <Button size="sm" type="submit" variant="outline">Rotate key</Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="glass-control rounded-[1.25rem] px-4 py-5 text-sm text-muted-foreground">
                No CRM connections have been configured yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seed inbox monitors</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {canManage ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href="/api/settings/seed-inboxes/connect">Connect Gmail monitor</Link>
                  </Button>
                  <form action="/api/settings/seed-inboxes/probe" method="post">
                    <Button size="sm" type="submit" variant="secondary">Queue placement probes</Button>
                  </form>
                </div>
                <form action="/api/settings/seed-inboxes" method="post" className="glass-control grid gap-3 rounded-[1.25rem] px-4 py-4">
                  <div className="grid gap-1">
                    <p className="font-medium">Register a monitor manually</p>
                    <p className="text-sm text-muted-foreground">
                      Use this for non-Gmail or not-yet-authorized seed addresses.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <select
                      name="provider"
                      defaultValue="gmail"
                      className="glass-control h-11 rounded-[1rem] border-0 px-4 text-sm shadow-none"
                    >
                      <option value="gmail">gmail</option>
                      <option value="outlook">outlook</option>
                      <option value="yahoo">yahoo</option>
                      <option value="other">other</option>
                    </select>
                    <input
                      type="email"
                      name="emailAddress"
                      placeholder="seed@yourdomain.com"
                      className="glass-control h-11 rounded-[1rem] border-0 px-4 text-sm shadow-none md:col-span-2"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" type="submit">Save monitor</Button>
                  </div>
                </form>
              </>
            ) : null}

            {adminSummary.seedInboxes.length ? (
              adminSummary.seedInboxes.map((inbox) => (
                <div key={inbox.id} className="glass-control grid gap-3 rounded-[1.25rem] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{inbox.email_address}</p>
                      <p className="text-sm text-muted-foreground">
                        {inbox.provider} / {inbox.status}
                        {inbox.connection_status ? ` / ${inbox.connection_status}` : ""}
                      </p>
                    </div>
                    <HealthBadge status={inbox.last_error ? "error" : inbox.health_status === "healthy" ? "healthy" : "warning"} />
                  </div>
                  <div className="grid gap-1 text-xs text-muted-foreground">
                    <p>Last probe: {formatDate(inbox.last_probe_at)}</p>
                    <p>Last check: {formatDate(inbox.last_checked_at)}</p>
                    <p>Latest placement: {inbox.last_result_status ?? "No observed result yet"}</p>
                    {inbox.last_error ? <p className="text-danger">{inbox.last_error}</p> : null}
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <form action="/api/settings/seed-inboxes" method="post">
                        <input type="hidden" name="seedInboxId" value={inbox.id} />
                        <input type="hidden" name="status" value={inbox.status === "paused" ? "active" : "paused"} />
                        <Button size="sm" type="submit" variant="outline">
                          {inbox.status === "paused" ? "Resume monitor" : "Pause monitor"}
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="glass-control rounded-[1.25rem] px-4 py-5 text-sm text-muted-foreground">
                No seed inbox monitors are configured yet.
              </div>
            )}

            <div className="glass-control rounded-[1.25rem] px-4 py-4">
              <p className="font-medium">Recent placement observations</p>
              <div className="mt-3 grid gap-2 text-sm">
                {adminSummary.seedResults.length ? (
                  adminSummary.seedResults.map((result) => (
                    <div key={result.id} className="rounded-[1rem] bg-white/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{result.placement_status}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(result.observed_at)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{result.probe_key}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No placement observations recorded yet.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
