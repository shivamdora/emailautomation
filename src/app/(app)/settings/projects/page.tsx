import { PageHeader } from "@/components/layout/page-header";
import { ProjectLogoForm } from "@/components/projects/project-logo-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { getProjectMonogram } from "@/lib/projects/shared";
import { listWorkspaceProjectMailboxRegistry } from "@/services/project-service";

type ProjectsSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

function getBannerMessage(params: Record<string, string | string[] | undefined>) {
  const status = typeof params.status === "string" ? params.status : null;
  const message = typeof params.message === "string" ? decodeURIComponent(params.message) : null;

  if (status === "created") {
    return {
      tone: "success" as const,
      text: "Project created successfully.",
    };
  }

  if (status === "updated") {
    return {
      tone: "success" as const,
      text: "Project details updated.",
    };
  }

      if (status === "error") {
        return {
          tone: "error" as const,
      text: message || "Project update failed.",
    };
  }

  return null;
}

export default async function ProjectsSettingsPage({ searchParams }: ProjectsSettingsPageProps) {
  const workspace = await getWorkspaceContext();
  const params = (await searchParams) ?? {};
  const banner = getBannerMessage(params);
  const highlightCreate = params.create === "1";
  const projectRegistry = await listWorkspaceProjectMailboxRegistry(workspace.workspaceId);

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={workspace.workspaceName}
        title="Projects"
        description="Create projects, upload brand assets, and keep sender details separated so each outbound motion has its own identity."
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

      <Card className={highlightCreate ? "border-[rgba(118,174,201,0.45)] shadow-[0_18px_40px_rgba(17,39,63,0.12)]" : ""}>
        <CardHeader className="gap-2">
          <CardTitle>Create project</CardTitle>
          <p className="text-sm text-muted-foreground">
            Every project gets its own website, brand profile, sender identity, and mailbox group.
          </p>
        </CardHeader>
        <CardContent>
          <form action="/api/projects" method="post" className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground" htmlFor="new-project-name">
                  Project name
                </label>
                <input
                  id="new-project-name"
                  name="name"
                  required
                  className="glass-control h-12 rounded-[1.1rem] border-0 px-4 text-sm shadow-none"
                  placeholder="ShelterScore outbound"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground" htmlFor="new-project-website">
                  Website
                </label>
                <input
                  id="new-project-website"
                  name="website"
                  className="glass-control h-12 rounded-[1.1rem] border-0 px-4 text-sm shadow-none"
                  placeholder="https://example.com"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground" htmlFor="new-project-brand">
                  Brand name
                </label>
                <input
                  id="new-project-brand"
                  name="brandName"
                  className="glass-control h-12 rounded-[1.1rem] border-0 px-4 text-sm shadow-none"
                  placeholder="ShelterScore"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground" htmlFor="new-project-sender-name">
                  Sender display name
                </label>
                <input
                  id="new-project-sender-name"
                  name="senderDisplayName"
                  className="glass-control h-12 rounded-[1.1rem] border-0 px-4 text-sm shadow-none"
                  placeholder="Jayant Solanki"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground" htmlFor="new-project-sender-title">
                  Sender title
                </label>
                <input
                  id="new-project-sender-title"
                  name="senderTitle"
                  className="glass-control h-12 rounded-[1.1rem] border-0 px-4 text-sm shadow-none"
                  placeholder="Growth lead"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="new-project-signature">
                Sender signature
              </label>
              <textarea
                id="new-project-signature"
                name="senderSignature"
                className="glass-control min-h-28 rounded-[1.1rem] border-0 px-4 py-3 text-sm shadow-none"
                placeholder={"Best,\nJayant\nOutboundFlow"}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Create project</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">Manage projects</h2>
            <p className="text-sm text-muted-foreground">
              Update brand details, sender identity, logo, and mailbox context for each project.
            </p>
          </div>
          <Badge variant="neutral">{projectRegistry.length} projects</Badge>
        </div>

        <div className="grid gap-4">
          {projectRegistry.map((project) => (
            <Card key={project.id} id={`project-${project.id}`}>
              <CardHeader className="gap-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <ProjectAvatar name={project.name} brandName={project.brand_name} logoUrl={project.logo_url} />
                    <div className="min-w-0 space-y-1">
                      <CardTitle>{project.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {project.website || project.brand_name || "Project profile"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {project.id === workspace.activeProjectId ? <Badge variant="success">Active project</Badge> : null}
                    <Badge variant="neutral">{project.gmailAccounts.length} mailboxes</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <form action={`/api/projects/${project.id}`} method="post" className="grid gap-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-foreground" htmlFor={`project-name-${project.id}`}>
                        Project name
                      </label>
                      <input
                        id={`project-name-${project.id}`}
                        name="name"
                        required
                        defaultValue={project.name}
                        className="glass-control h-12 rounded-[1.1rem] border-0 px-4 text-sm shadow-none"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-foreground" htmlFor={`project-website-${project.id}`}>
                        Website
                      </label>
                      <input
                        id={`project-website-${project.id}`}
                        name="website"
                        defaultValue={project.website ?? ""}
                        className="glass-control h-12 rounded-[1.1rem] border-0 px-4 text-sm shadow-none"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-foreground" htmlFor={`project-brand-${project.id}`}>
                        Brand name
                      </label>
                      <input
                        id={`project-brand-${project.id}`}
                        name="brandName"
                        defaultValue={project.brand_name ?? ""}
                        className="glass-control h-12 rounded-[1.1rem] border-0 px-4 text-sm shadow-none"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-foreground" htmlFor={`project-sender-name-${project.id}`}>
                        Sender display name
                      </label>
                      <input
                        id={`project-sender-name-${project.id}`}
                        name="senderDisplayName"
                        defaultValue={project.sender_display_name ?? ""}
                        className="glass-control h-12 rounded-[1.1rem] border-0 px-4 text-sm shadow-none"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-foreground" htmlFor={`project-sender-title-${project.id}`}>
                        Sender title
                      </label>
                      <input
                        id={`project-sender-title-${project.id}`}
                        name="senderTitle"
                        defaultValue={project.sender_title ?? ""}
                        className="glass-control h-12 rounded-[1.1rem] border-0 px-4 text-sm shadow-none"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-foreground" htmlFor={`project-signature-${project.id}`}>
                      Sender signature
                    </label>
                    <textarea
                      id={`project-signature-${project.id}`}
                      name="senderSignature"
                      defaultValue={project.sender_signature ?? ""}
                      className="glass-control min-h-28 rounded-[1.1rem] border-0 px-4 py-3 text-sm shadow-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit">Save project details</Button>
                  </div>
                </form>

                <div className="grid gap-4">
                  <ProjectLogoForm projectId={project.id} defaultLogoUrl={project.logo_url} />

                  <div className="glass-control rounded-[1.5rem] p-4">
                    <p className="text-sm font-semibold tracking-[-0.02em] text-foreground">Mailbox registry</p>
                    <div className="mt-3 grid gap-2">
                      {project.gmailAccounts.length ? (
                        project.gmailAccounts.map((account) => (
                          <div
                            key={account.id}
                            className="rounded-[1.1rem] border border-white/60 bg-white/76 px-3 py-3 text-sm"
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
                        <div className="rounded-[1.1rem] border border-dashed border-border/70 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                          No sending mailbox is attached to this project yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
