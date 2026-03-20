import Link from "next/link";
import { ProfileForm } from "@/components/forms/profile-form";
import { PageHeader } from "@/components/layout/page-header";
import { GmailConnectButton } from "@/components/profile/gmail-connect-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { productContent } from "@/content/product";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { getProjectMonogram } from "@/lib/projects/shared";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getWorkspaceGmailAccounts } from "@/services/gmail-service";
import { listWorkspaceProjectMailboxRegistry } from "@/services/project-service";

type ProfilePageProps = {
  searchParams?: Promise<{
    gmail?: string;
    message?: string;
  }>;
};

function getGmailBanner(gmail?: string, message?: string) {
  if (gmail === "connected") {
    return {
      tone: "success",
      text: productContent.profile.banners.connected,
    };
  }

  if (gmail === "disconnected") {
    return {
      tone: "default",
      text: productContent.profile.banners.disconnected,
    };
  }

  if (gmail === "missing-code") {
    return {
      tone: "error",
      text: productContent.profile.banners.missingCode,
    };
  }

  if (gmail === "error") {
    return {
      tone: "error",
      text: message ? decodeURIComponent(message) : productContent.profile.banners.genericError,
    };
  }

  return null;
}

function ProjectAvatar({
  name,
  brandName,
  logoUrl,
}: {
  name: string;
  brandName?: string | null;
  logoUrl?: string | null;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className="size-14 rounded-[1.25rem] border border-white/75 object-cover shadow-[0_16px_28px_rgba(17,39,63,0.1)]"
      />
    );
  }

  return (
    <span className="flex size-14 items-center justify-center rounded-[1.25rem] border border-white/78 bg-[linear-gradient(180deg,rgba(215,237,247,0.92),rgba(255,255,255,0.84))] font-mono text-sm uppercase tracking-[0.2em] text-accent-foreground shadow-[0_16px_28px_rgba(17,39,63,0.08)]">
      {getProjectMonogram({ name, brand_name: brandName ?? null })}
    </span>
  );
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = (await searchParams) ?? {};
  const workspace = await getWorkspaceContext();
  const supabase = createAdminSupabaseClient();
  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("full_name, title")
    .eq("id", workspace.userId)
    .maybeSingle();
  const profile = rawProfile as { full_name?: string | null; title?: string | null } | null;
  const [gmailAccounts, projectMailboxRegistry] = await Promise.all([
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

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={productContent.profile.header.eyebrow}
        title={productContent.profile.header.title}
        description={productContent.profile.header.description}
      />

      {gmailBanner ? (
        <div
          className={
            gmailBanner.tone === "error"
              ? "rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
              : gmailBanner.tone === "success"
                ? "rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700"
                : "rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm text-foreground"
          }
        >
          {gmailBanner.text}
        </div>
      ) : null}

      <ProfileForm
        defaultValues={{
          fullName: profile?.full_name ?? "",
          title: profile?.title ?? "",
        }}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <ProjectAvatar
                  name={workspace.activeProject.name}
                  brandName={workspace.activeProject.brand_name}
                  logoUrl={workspace.activeProject.logo_url}
                />
                <div className="min-w-0 space-y-1">
                  <CardTitle>{workspace.activeProject.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {workspace.activeProject.website ||
                      workspace.activeProject.brand_name ||
                      "No website or brand profile added yet."}
                  </p>
                </div>
              </div>
              <Badge variant="success">Active project</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/60 bg-white/62 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Brand name</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {workspace.activeProject.brand_name || "Not set"}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-white/60 bg-white/62 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Website</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {workspace.activeProject.website || "Not set"}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-white/60 bg-white/62 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Sender display</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {workspace.activeProject.sender_display_name || "Not set"}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-white/60 bg-white/62 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Sender title</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {workspace.activeProject.sender_title || "Not set"}
                </p>
              </div>
            </div>
            <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              {workspace.activeProject.sender_signature ||
                "Add a sender signature in project settings so campaigns and one-to-one replies stay on brand."}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="sm">
                <Link href="/settings/projects">Manage project settings</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/settings/projects?create=1">Create another project</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle>{productContent.profile.gmailCard.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {workspace.activeProject.name} sender identities available for campaigns and replies.
              </p>
            </div>
            <GmailConnectButton label={productContent.profile.gmailCard.connectLabel} />
          </CardHeader>
          <CardContent className="grid gap-3">
            {gmailAccounts.length ? (
              gmailAccounts.map((account) => (
                <div
                  key={account.id}
                  className="glass-control flex items-center justify-between rounded-[1.5rem] px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{account.email_address}</p>
                    <p className="text-muted-foreground">
                      {account.status} / {account.approval_status ?? "pending"}
                    </p>
                    {account.approval_note ? (
                      <p className="text-xs text-muted-foreground">{account.approval_note}</p>
                    ) : null}
                  </div>
                  <form action="/api/gmail/disconnect" method="post">
                    <input type="hidden" name="gmailAccountId" value={account.id} />
                    <button className="font-medium text-danger">
                      {productContent.profile.gmailCard.disconnectLabel}
                    </button>
                  </form>
                </div>
              ))
            ) : (
              <div className="glass-control rounded-[1.5rem] px-4 py-5">
                <p className="font-medium text-foreground">{productContent.profile.gmailCard.emptyTitle}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {productContent.profile.gmailCard.emptyDescription}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle>Project mailbox registry</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review every sending mailbox in the workspace grouped under the project it belongs to.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {projectMailboxRegistry.map((project) => (
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
                    No sender mailbox is attached to this project yet.
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
