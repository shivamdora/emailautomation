import Link from "next/link";
import { FolderKanban, Mail, Settings2 } from "lucide-react";
import { ProfileForm } from "@/components/forms/profile-form";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectAvatar } from "@/components/projects/project-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function ProfilePage() {
  const workspace = await getWorkspaceContext();
  const supabase = createAdminSupabaseClient();
  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("full_name, title")
    .eq("id", workspace.userId)
    .maybeSingle();
  const profile = rawProfile as { full_name?: string | null; title?: string | null } | null;
  const identityReady = Boolean(
    workspace.activeProject.sender_display_name?.trim() &&
      workspace.activeProject.sender_title?.trim() &&
      workspace.activeProject.sender_signature?.trim(),
  );

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Profile"
        title="Personal settings"
        description="Keep your personal identity up to date, then jump into sender setup and project branding from the dedicated settings pages."
      />

      <ProfileForm
        defaultValues={{
          fullName: profile?.full_name ?? "",
          title: profile?.title ?? "",
        }}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-white/74 bg-[rgba(215,237,247,0.84)] text-accent-foreground">
                <Mail className="size-5" />
              </span>
              <div className="space-y-1">
                <CardTitle>Sending setup moved</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Mailbox connection, sender approvals, and mailbox registry now live in Settings so there is one clear place to manage sending.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-[1.35rem] border border-white/70 bg-white/62 px-4 py-4 text-sm text-muted-foreground">
              Open Sending when you need to connect Gmail, review approvals, or check which mailbox belongs to each project.
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/settings/sending">Open Sending</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/settings">Back to settings overview</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-4">
            <div className="flex items-start gap-4">
              <ProjectAvatar
                name={workspace.activeProject.name}
                brandName={workspace.activeProject.brand_name}
                logoUrl={workspace.activeProject.logo_url}
              />
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{workspace.activeProject.name}</CardTitle>
                  <Badge variant="success">Active project</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {workspace.activeProject.website ||
                    workspace.activeProject.brand_name ||
                    "Project brand profile"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Sender display</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {workspace.activeProject.sender_display_name || "Not set"}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/60 bg-white/58 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Sender title</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {workspace.activeProject.sender_title || "Not set"}
                </p>
              </div>
            </div>
            <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              {workspace.activeProject.sender_signature ||
                "Finish the sender signature in project settings so campaigns and replies stay consistent."}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.35rem] border border-white/70 bg-white/62 px-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Project identity</p>
                <p className="text-sm text-muted-foreground">
                  {identityReady
                    ? "The active project has brand and sender details ready for outbound work."
                    : "This project still needs sender details before it feels launch-ready."}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/settings/projects">
                  <FolderKanban className="size-4" />
                  Manage projects
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-white/74 bg-white/84 text-foreground">
              <Settings2 className="size-5" />
            </span>
            <div className="space-y-1">
              <CardTitle>Where to manage workspace setup now</CardTitle>
              <p className="text-sm text-muted-foreground">
                Personal profile stays here. Operational setup moved into Settings so owners and operators have a clearer flow.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-4">
            <p className="text-sm font-semibold text-foreground">Settings overview</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              See setup status, workspace readiness, project summaries, and the most important next actions.
            </p>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/settings">Open overview</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-4">
            <p className="text-sm font-semibold text-foreground">Sending</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Connect Gmail, approve sender identities, and review the mailbox registry grouped by project.
            </p>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/settings/sending">Open Sending</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-white/60 bg-white/58 px-4 py-4">
            <p className="text-sm font-semibold text-foreground">Projects</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Update logos, websites, sender identity, and signatures for each project in one place.
            </p>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/settings/projects">Open Projects</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
