import Link from "next/link";
import { ChevronRight, Mail, ShieldCheck, Signature } from "lucide-react";
import { ProjectAvatar } from "@/components/projects/project-avatar";
import { GmailConnectButton } from "@/components/profile/gmail-connect-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { getWorkspaceGmailAccounts } from "@/services/gmail-service";
import { listWorkspaceProjectMailboxRegistry } from "@/services/project-service";

type SendingPageProps = {
  searchParams?: Promise<{
    gmail?: string;
    message?: string;
  }>;
};

function getGmailBanner(gmail?: string, message?: string) {
  if (gmail === "connected") {
    return {
      tone: "success" as const,
      text: "Mailbox connected successfully.",
    };
  }

  if (gmail === "disconnected") {
    return {
      tone: "default" as const,
      text: "Mailbox disconnected.",
    };
  }

  if (gmail === "missing-code") {
    return {
      tone: "error" as const,
      text: "Mailbox connection could not be completed because the Google callback was missing a code.",
    };
  }

  if (gmail === "error") {
    return {
      tone: "error" as const,
      text: message ? decodeURIComponent(message) : "Mailbox connection failed.",
    };
  }

  return null;
}

export default async function SettingsSendingPage({ searchParams }: SendingPageProps) {
  const params = (await searchParams) ?? {};
  const workspace = await getWorkspaceContext();
  const canManage = ["owner", "admin"].includes(workspace.workspaceRole);
  const [activeProjectMailboxes, projectRegistry] = await Promise.all([
    getWorkspaceGmailAccounts(workspace.workspaceId, {
      projectId: workspace.activeProjectId,
    }) as Promise<
      Array<{
        id: string;
        email_address: string;
        status: string;
        approval_status?: string | null;
        approval_note?: string | null;
      }>
    >,
    listWorkspaceProjectMailboxRegistry(workspace.workspaceId),
  ]);
  const gmailBanner = getGmailBanner(params.gmail, params.message);
  const flattenedMailboxes = projectRegistry
    .flatMap((project) =>
      project.gmailAccounts.map((account) => ({
        ...account,
        projectId: project.id,
        projectName: project.name,
      })),
    )
    .sort((left, right) => {
      const leftPriority = left.projectId === workspace.activeProjectId ? 1 : 0;
      const rightPriority = right.projectId === workspace.activeProjectId ? 1 : 0;
      return rightPriority - leftPriority;
    });

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={workspace.workspaceName}
        title="Sending"
        description="Connect mailboxes, approve sender identities, and keep every sending address tied to the right project before campaigns go live."
        actions={<GmailConnectButton label="Connect mailbox" />}
      />

      {gmailBanner ? (
        <div
          className={
            gmailBanner.tone === "error"
              ? "rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
              : gmailBanner.tone === "success"
                ? "rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700"
                : "rounded-2xl border border-white/70 bg-white/72 px-4 py-3 text-sm text-foreground"
          }
        >
          {gmailBanner.text}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-white/74 bg-[rgba(215,237,247,0.84)] text-accent-foreground">
                <Mail className="size-5" />
              </span>
              <div className="space-y-1">
                <CardTitle>Connect mailbox</CardTitle>
                <p className="text-sm text-muted-foreground">
                  This is now the source of truth for sender setup across the workspace.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-[1.45rem] border border-white/70 bg-white/62 px-4 py-4">
              <div className="flex min-w-0 items-center gap-4">
                <ProjectAvatar
                  name={workspace.activeProject.name}
                  brandName={workspace.activeProject.brand_name}
                  logoUrl={workspace.activeProject.logo_url}
                />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-foreground">{workspace.activeProject.name}</p>
                  <p className="text-sm text-muted-foreground">
                    New mailboxes connected here attach to the active project.
                  </p>
                </div>
              </div>
              <Badge variant="success">Active project</Badge>
            </div>

            {activeProjectMailboxes.length ? (
              <div className="grid gap-3">
                {activeProjectMailboxes.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">{account.email_address}</p>
                      <p className="text-muted-foreground">
                        {account.status} / {account.approval_status ?? "pending"}
                      </p>
                      {account.approval_note ? (
                        <p className="text-xs text-muted-foreground">{account.approval_note}</p>
                      ) : null}
                    </div>
                    <form action="/api/gmail/disconnect" method="post">
                      <input type="hidden" name="gmailAccountId" value={account.id} />
                      <Button size="sm" type="submit" variant="outline">
                        Disconnect
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                No mailbox is connected to the active project yet. Connect Gmail here so campaigns can send from a real sender.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-white/74 bg-white/84 text-foreground">
                <Signature className="size-5" />
              </span>
              <div className="space-y-1">
                <CardTitle>Project sending identities</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Keep sender name, title, and signature aligned with the project each mailbox belongs to.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {projectRegistry.map((project) => {
              const identityReady = Boolean(
                project.sender_display_name?.trim() &&
                  project.sender_title?.trim() &&
                  project.sender_signature?.trim(),
              );

              return (
                <div
                  key={project.id}
                  className="rounded-[1.3rem] border border-white/65 bg-white/58 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProjectAvatar
                        name={project.name}
                        brandName={project.brand_name}
                        logoUrl={project.logo_url}
                        sizeClassName="size-12 rounded-[1.1rem]"
                      />
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-foreground">{project.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {project.sender_display_name || "No sender display name"}{" "}
                          {project.sender_title ? `· ${project.sender_title}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {project.id === workspace.activeProjectId ? <Badge variant="success">Active</Badge> : null}
                      <Badge variant={identityReady ? "success" : "neutral"}>
                        {identityReady ? "Identity ready" : "Needs details"}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {project.sender_signature || "Add a signature in project settings so replies stay consistent."}
                  </p>
                  <div className="mt-3">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/settings/projects#project-${project.id}`}>Edit project sender details</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-white/74 bg-white/84 text-foreground">
              <ShieldCheck className="size-5" />
            </span>
            <div className="space-y-1">
              <CardTitle>Sender approvals</CardTitle>
              <p className="text-sm text-muted-foreground">
                Approvals are visible to everyone, but only owners and admins can approve or reject mailboxes.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {flattenedMailboxes.length ? (
            flattenedMailboxes.map((account) => (
              <div
                key={account.id}
                className="rounded-[1.35rem] border border-white/65 bg-white/58 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{account.email_address}</p>
                    <p className="text-sm text-muted-foreground">
                      {account.projectName} · {account.status}
                    </p>
                    {account.approval_note ? (
                      <p className="text-xs text-muted-foreground">{account.approval_note}</p>
                    ) : null}
                  </div>
                  <Badge variant={account.approval_status === "approved" ? "success" : "neutral"}>
                    {account.approval_status ?? "pending"}
                  </Badge>
                </div>
                {canManage && account.approval_status !== "approved" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
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
            <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
              No workspace mailboxes have been connected yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Mailbox registry by project</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review every sending mailbox grouped under the project it belongs to.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/projects">
                Manage project details
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {projectRegistry.map((project) => (
            <div
              key={project.id}
              className="rounded-[1.6rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(246,250,253,0.78))] p-4 shadow-[0_14px_30px_rgba(17,39,63,0.08)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ProjectAvatar name={project.name} brandName={project.brand_name} logoUrl={project.logo_url} />
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-base font-semibold tracking-[-0.02em] text-foreground">
                      {project.name}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {project.website || project.brand_name || "Project profile"}
                    </p>
                  </div>
                </div>
                {project.id === workspace.activeProjectId ? <Badge variant="success">Active</Badge> : null}
              </div>
              <div className="mt-4 grid gap-3">
                {project.gmailAccounts.length ? (
                  project.gmailAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="rounded-[1.15rem] border border-white/60 bg-white/76 px-4 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-medium text-foreground">{account.email_address}</p>
                        <Badge
                          variant={account.approval_status === "approved" ? "success" : "neutral"}
                        >
                          {account.approval_status ?? "pending"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">{account.status}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.15rem] border border-dashed border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                    No sending mailbox is attached to this project yet.
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
