import Link from "next/link";
import { CheckCircle2, ChevronRight, FolderKanban, Mail, PlugZap, Users } from "lucide-react";
import { ProjectAvatar } from "@/components/projects/project-avatar";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { getWorkspaceAdminSummary } from "@/services/admin-service";
import { listWorkspaceProjectMailboxRegistry } from "@/services/project-service";

function formatDate(value?: string | null) {
  if (!value) {
    return "No sync yet";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function SettingsPage() {
  const workspace = await getWorkspaceContext();
  const [adminSummary, projectRegistry] = await Promise.all([
    getWorkspaceAdminSummary(workspace.workspaceId),
    listWorkspaceProjectMailboxRegistry(workspace.workspaceId),
  ]);

  const canManage = ["owner", "admin"].includes(workspace.workspaceRole);
  const approvedSenders = adminSummary.gmailAccounts.filter(
    (account) => account.approval_status === "approved",
  ).length;
  const activeProjectMailboxCount =
    projectRegistry.find((project) => project.id === workspace.activeProjectId)?.gmailAccounts.length ?? 0;
  const projectsWithMailboxes = projectRegistry.filter((project) => project.gmailAccounts.length > 0).length;
  const activeProjectIdentityReady = Boolean(
    workspace.activeProject.sender_display_name?.trim() &&
      workspace.activeProject.sender_title?.trim() &&
      workspace.activeProject.sender_signature?.trim(),
  );
  const latestCrmConnection =
    [...adminSummary.crmConnections].sort((left, right) =>
      Date.parse(right.last_synced_at ?? "") - Date.parse(left.last_synced_at ?? ""),
    )[0] ?? null;

  const checklistItems = [
    {
      key: "mailbox",
      label: "Connect a sender mailbox",
      description: adminSummary.gmailAccounts.length
        ? `${adminSummary.gmailAccounts.length} mailbox${adminSummary.gmailAccounts.length === 1 ? "" : "es"} connected across the workspace.`
        : "Connect the first mailbox so campaigns can send from a real identity.",
      complete: adminSummary.gmailAccounts.length > 0,
      href: "/settings/sending",
      cta: adminSummary.gmailAccounts.length ? "Manage sending" : "Connect mailbox",
    },
    {
      key: "approval",
      label: "Get at least one approved sender",
      description: approvedSenders
        ? `${approvedSenders} sender${approvedSenders === 1 ? "" : "s"} approved and ready to launch.`
        : "Approval keeps the first live send obvious and safe for the workspace.",
      complete: approvedSenders > 0,
      href: "/settings/sending",
      cta: approvedSenders ? "Review approvals" : "Approve senders",
    },
    {
      key: "identity",
      label: "Finish the active project sender identity",
      description: activeProjectIdentityReady
        ? `${workspace.activeProject.name} has a sender name, title, and signature ready.`
        : `Complete ${workspace.activeProject.name} so messages feel branded and human.`,
      complete: activeProjectIdentityReady,
      href: "/settings/projects",
      cta: activeProjectIdentityReady ? "Edit project" : "Finish project details",
    },
    {
      key: "crm",
      label: "Connect CRM if this workspace needs sync",
      description: adminSummary.crmConnections.length
        ? `${adminSummary.crmConnections.length} integration${adminSummary.crmConnections.length === 1 ? "" : "s"} connected for sync and writeback.`
        : "Optional, but useful if leads or replies should flow back into a CRM.",
      complete: adminSummary.crmConnections.length > 0,
      href: "/settings/integrations",
      cta: adminSummary.crmConnections.length ? "Open integrations" : "Connect CRM",
    },
  ];

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={workspace.workspaceName}
        title="Settings"
        description="Keep the workspace easy to operate: finish sender setup, review project identity, connect integrations, and keep advanced controls out of the daily path."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/sending">Open Sending</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/settings/projects">Manage projects</Link>
            </Button>
          </>
        }
      />

      {!canManage ? (
        <div className="rounded-2xl border border-white/70 bg-white/72 px-4 py-4 text-sm text-muted-foreground">
          You are viewing workspace settings in a limited mode. Owner or admin access is required for approvals,
          integrations, billing controls, and advanced operations.
        </div>
      ) : null}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Setup checklist</CardTitle>
              <p className="text-sm text-muted-foreground">
                These are the few things that matter most before a workspace starts sending at scale.
              </p>
            </div>
            <Badge variant="neutral">
              {checklistItems.filter((item) => item.complete).length} / {checklistItems.length} complete
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {checklistItems.map((item) => (
            <div
              key={item.key}
              className="flex flex-wrap items-start justify-between gap-4 rounded-[1.45rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,250,253,0.8))] px-4 py-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border ${
                    item.complete
                      ? "border-white/82 bg-[rgba(215,237,247,0.88)] text-accent-foreground"
                      : "border-white/70 bg-white/76 text-muted-foreground"
                  }`}
                >
                  <CheckCircle2 className="size-4" />
                </span>
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <Badge variant={item.complete ? "success" : "neutral"}>
                      {item.complete ? "Ready" : item.key === "crm" ? "Optional" : "Needs setup"}
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={item.href}>{item.cta}</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-white/74 bg-[rgba(215,237,247,0.84)] text-accent-foreground">
                <Mail className="size-5" />
              </span>
              <div className="space-y-1">
                <CardTitle>Sending readiness</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Mailboxes, approvals, and active-project sender setup in one glance.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-4 rounded-[1.45rem] border border-white/70 bg-white/64 px-4 py-4">
              <ProjectAvatar
                name={workspace.activeProject.name}
                brandName={workspace.activeProject.brand_name}
                logoUrl={workspace.activeProject.logo_url}
              />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-foreground">{workspace.activeProject.name}</p>
                <p className="text-sm text-muted-foreground">
                  {workspace.activeProject.website ||
                    workspace.activeProject.brand_name ||
                    "Add brand details so sender identity feels complete."}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Connected</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{adminSummary.gmailAccounts.length}</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Approved</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{approvedSenders}</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Active project</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{activeProjectMailboxCount}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[1.35rem] border border-dashed border-border/70 bg-background/70 px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                {approvedSenders
                  ? "The workspace has approved senders ready for campaigns."
                  : "No approved sender is ready yet."}
              </span>
              <Button asChild size="sm">
                <Link href="/settings/sending">Open sending</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-white/74 bg-white/84 text-foreground">
                <FolderKanban className="size-5" />
              </span>
              <div className="space-y-1">
                <CardTitle>Projects summary</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Keep every outbound motion separated by brand, signature, and mailbox context.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Projects</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{projectRegistry.length}</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">With mailboxes</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{projectsWithMailboxes}</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Identity</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {activeProjectIdentityReady ? "Active project ready" : "Finish active project"}
                </p>
              </div>
            </div>
            <div className="rounded-[1.45rem] border border-white/70 bg-white/64 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{workspace.activeProject.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {workspace.activeProject.sender_display_name || "No sender display name yet"}
                    {" · "}
                    {workspace.activeProject.sender_title || "No sender title yet"}
                  </p>
                </div>
                <Badge variant={activeProjectIdentityReady ? "success" : "neutral"}>
                  {activeProjectIdentityReady ? "Ready to send" : "Needs identity"}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {workspace.activeProject.sender_signature ||
                  "Add a signature and sender details so campaigns and replies stay consistent."}
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="justify-between">
              <Link href="/settings/projects">
                Manage projects
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-white/74 bg-white/84 text-foreground">
                <PlugZap className="size-5" />
              </span>
              <div className="space-y-1">
                <CardTitle>Integrations summary</CardTitle>
                <p className="text-sm text-muted-foreground">
                  CRM connections should stay discoverable, but not crowd daily sending work.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-[1.45rem] border border-white/70 bg-white/64 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {adminSummary.crmConnections.length
                    ? `${adminSummary.crmConnections.length} integration${adminSummary.crmConnections.length === 1 ? "" : "s"} connected`
                    : "No CRM connected yet"}
                </p>
                <Badge variant={adminSummary.crmConnections.length ? "success" : "neutral"}>
                  {adminSummary.crmConnections.length ? "Connected" : "Optional"}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {latestCrmConnection
                  ? `${latestCrmConnection.provider_account_label ?? latestCrmConnection.provider} last synced ${formatDate(latestCrmConnection.last_synced_at)}.`
                  : "Add a CRM when this workspace needs lead sync, writeback, or inbound API access."}
              </p>
            </div>
            <div className="grid gap-2">
              {adminSummary.crmConnections.slice(0, 3).map((connection) => (
                <div
                  key={connection.id}
                  className="rounded-[1.15rem] border border-white/60 bg-white/58 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-foreground">
                      {connection.provider_account_label ?? connection.provider}
                    </p>
                    <Badge variant={connection.last_error ? "danger" : "neutral"}>
                      {connection.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {connection.provider_account_email || connection.provider}
                  </p>
                </div>
              ))}
            </div>
            <Button asChild variant="outline" size="sm" className="justify-between">
              <Link href="/settings/integrations">
                Open integrations
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-white/74 bg-white/84 text-foreground">
                <Users className="size-5" />
              </span>
              <div className="space-y-1">
                <CardTitle>Team & workspace summary</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Keep day-to-day settings clean, and push workspace administration into Advanced.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Members</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{adminSummary.members.length}</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Workspace</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {workspace.workspaceKind} / {workspace.workspaceRole}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Advanced</p>
                <p className="mt-2 text-sm font-semibold text-foreground">Billing, health, access</p>
              </div>
            </div>
            <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              Workspace switching, internal billing state, diagnostics, and seed inbox monitoring now live in Advanced so the main settings view stays focused on setup and readiness.
            </div>
            <Button asChild variant="outline" size="sm" className="justify-between">
              <Link href="/settings/advanced">
                Open advanced
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
