import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, Mail, ShieldCheck, Signature } from "lucide-react";
import { GmailMark } from "@/components/icons/gmail-mark";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectAvatar } from "@/components/projects/project-avatar";
import { MailboxConnectButton } from "@/components/profile/gmail-connect-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { OUTLOOK_ICON_URL } from "@/lib/mailboxes/provider";
import { getWorkspaceMailboxAccounts } from "@/services/mailbox-service";
import { listWorkspaceProjectMailboxRegistry } from "@/services/project-service";

type SendingPageProps = {
  searchParams?: Promise<{
    gmail?: string;
    mailbox?: string;
    message?: string;
    provider?: string;
  }>;
};

type MailboxListItem = {
  id: string;
  provider: "gmail" | "outlook";
  email_address: string;
  provider_account_label?: string | null;
  status: string;
  approval_status?: string | null;
  approval_note?: string | null;
};

function getProviderTitle(provider: string | null | undefined) {
  return provider === "outlook" ? "Outlook" : "Gmail";
}

function ProviderMark({
  provider,
  className = "size-5",
}: {
  provider: "gmail" | "outlook";
  className?: string;
}) {
  if (provider === "outlook") {
    return (
      <Image
        src={OUTLOOK_ICON_URL}
        alt=""
        width={48}
        height={48}
        className={`${className} rounded-sm`}
      />
    );
  }

  return <GmailMark className={className} />;
}

function ProviderBadge({ provider }: { provider: "gmail" | "outlook" }) {
  return (
    <Badge variant="neutral" className="gap-1.5">
      <ProviderMark provider={provider} className="size-3.5" />
      {getProviderTitle(provider)}
    </Badge>
  );
}

function getMailboxBanner(mailbox?: string, message?: string, provider?: string) {
  const providerTitle = getProviderTitle(provider);

  if (mailbox === "connected") {
    return {
      tone: "success" as const,
      text: `${providerTitle} mailbox connected successfully.`,
    };
  }

  if (mailbox === "disconnected") {
    return {
      tone: "default" as const,
      text: `${providerTitle} mailbox disconnected.`,
    };
  }

  if (mailbox === "missing-code") {
    return {
      tone: "error" as const,
      text: `${providerTitle} connection could not be completed because the callback was missing a code.`,
    };
  }

  if (mailbox === "error") {
    return {
      tone: "error" as const,
      text: message ? decodeURIComponent(message) : `${providerTitle} mailbox connection failed.`,
    };
  }

  return null;
}

export default async function SettingsSendingPage({ searchParams }: SendingPageProps) {
  const params = (await searchParams) ?? {};
  const mailboxStatus = params.mailbox ?? params.gmail;
  const workspace = await getWorkspaceContext();
  const canManage = ["owner", "admin"].includes(workspace.workspaceRole);
  const [activeProjectMailboxes, projectRegistry] = await Promise.all([
    getWorkspaceMailboxAccounts(workspace.workspaceId, {
      projectId: workspace.activeProjectId,
    }) as Promise<MailboxListItem[]>,
    listWorkspaceProjectMailboxRegistry(workspace.workspaceId),
  ]);
  const mailboxBanner = getMailboxBanner(mailboxStatus, params.message, params.provider);
  const flattenedMailboxes = projectRegistry
    .flatMap((project) =>
      project.mailboxAccounts.map((account) => ({
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
        description="Connect Gmail and Outlook senders, approve mailbox identities, and keep every sending address aligned to the right project before campaigns go live."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/integrations">
              Open integrations
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        }
      />

      {mailboxBanner ? (
        <div
          className={
            mailboxBanner.tone === "error"
              ? "rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
              : mailboxBanner.tone === "success"
                ? "rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700"
                : "rounded-2xl border border-white/70 bg-white/72 px-4 py-3 text-sm text-foreground"
          }
        >
          {mailboxBanner.text}
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
                <CardTitle>Connect sender mailboxes</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Gmail and Outlook both attach to the active project here, while third-party routing stays on the integrations page.
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
                    New sender connections created here attach to the active project.
                  </p>
                </div>
              </div>
              <Badge variant="success">Active project</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                {
                  description: "Google Workspace or Gmail senders with the existing approval flow.",
                  label: "Gmail",
                  provider: "gmail" as const,
                },
                {
                  description: "Microsoft 365 or Outlook senders with provider-neutral mailbox sync.",
                  label: "Outlook",
                  provider: "outlook" as const,
                },
              ].map((provider) => (
                <div
                  key={provider.provider}
                  className="grid gap-4 rounded-[1.35rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,252,0.86))] p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 items-center justify-center rounded-[1rem] border border-white/74 bg-white/92 text-accent-foreground">
                      <ProviderMark provider={provider.provider} className="size-5" />
                    </span>
                    <div className="grid gap-1">
                      <p className="text-base font-semibold tracking-[-0.03em] text-foreground">{provider.label}</p>
                      <p className="text-sm leading-6 text-muted-foreground">{provider.description}</p>
                    </div>
                  </div>
                  <MailboxConnectButton
                    provider={provider.provider}
                    label={`Connect ${provider.label}`}
                  />
                </div>
              ))}
            </div>

            {activeProjectMailboxes.length ? (
              <div className="grid gap-3">
                {activeProjectMailboxes.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-3 text-sm"
                  >
                    <div className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{account.email_address}</p>
                        <ProviderBadge provider={account.provider} />
                      </div>
                      <p className="text-muted-foreground">
                        {account.status} / {account.approval_status ?? "pending"}
                      </p>
                      {account.provider_account_label &&
                      account.provider_account_label !== account.email_address ? (
                        <p className="text-xs text-muted-foreground">{account.provider_account_label}</p>
                      ) : null}
                      {account.approval_note ? (
                        <p className="text-xs text-muted-foreground">{account.approval_note}</p>
                      ) : null}
                    </div>
                    <form action="/api/mailboxes/disconnect" method="post">
                      <input type="hidden" name="mailboxAccountId" value={account.id} />
                      <input type="hidden" name="provider" value={account.provider} />
                      <Button size="sm" type="submit" variant="outline">
                        Disconnect
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                No mailbox is connected to the active project yet. Connect Gmail or Outlook here so campaigns can send from a real sender.
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
                Approvals are visible to everyone, but only owners and admins can approve or reject sender mailboxes.
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
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{account.email_address}</p>
                      <ProviderBadge provider={account.provider} />
                    </div>
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
                    <form action="/api/mailboxes/approve" method="post">
                      <input type="hidden" name="mailboxAccountId" value={account.id} />
                      <input type="hidden" name="provider" value={account.provider} />
                      <input type="hidden" name="approvalStatus" value="approved" />
                      <Button size="sm" type="submit">Approve sender</Button>
                    </form>
                    <form action="/api/mailboxes/approve" method="post">
                      <input type="hidden" name="mailboxAccountId" value={account.id} />
                      <input type="hidden" name="provider" value={account.provider} />
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
                Review every approved or pending sending mailbox grouped under the project it belongs to.
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
                {project.mailboxAccounts.length ? (
                  project.mailboxAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="rounded-[1.15rem] border border-white/60 bg-white/76 px-4 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{account.email_address}</p>
                          <ProviderBadge provider={account.provider} />
                        </div>
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
