"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, FolderPlus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getProjectMonogram, type ProjectSummary } from "@/lib/projects/shared";
import { cn } from "@/lib/utils";

function ProjectAvatar({
  project,
  compact = false,
}: {
  project: ProjectSummary | null | undefined;
  compact?: boolean;
}) {
  if (project?.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={project.logo_url}
        alt={project.name}
        className={cn(
          "shrink-0 rounded-[1rem] border border-white/78 object-cover shadow-[0_12px_24px_rgba(17,39,63,0.08)]",
          compact ? "size-9" : "size-10",
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[1.05rem] border border-white/78 bg-[linear-gradient(180deg,rgba(215,237,247,0.92),rgba(255,255,255,0.82))] font-mono text-[11px] uppercase tracking-[0.2em] text-accent-foreground shadow-[0_12px_24px_rgba(17,39,63,0.08)]",
        compact ? "size-9" : "size-10",
      )}
    >
      {getProjectMonogram(project)}
    </span>
  );
}

export function ProjectSwitcher({
  activeProjectId,
  projects,
  workspaceName,
  compact = false,
}: {
  activeProjectId: string;
  projects: ProjectSummary[];
  workspaceName: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const projectMeta = activeProject?.website?.trim() || activeProject?.brand_name?.trim() || "Project";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Active project"
          disabled={isPending}
          className={cn(
            "glass-control inline-flex w-full items-center justify-between gap-3 border-0 text-left shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55 [&>svg]:transition-transform [&[data-state=open]>svg]:rotate-180 data-[state=open]:bg-white/92",
            compact
              ? "size-12 justify-center rounded-[1.25rem] p-0 [&>svg]:hidden"
              : "min-h-[3.4rem] rounded-[1.35rem] border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,248,253,0.72))] px-3.5 py-3",
          )}
        >
          {compact ? (
            <>
              <ProjectAvatar project={activeProject} compact />
              <span className="sr-only">
                {activeProject?.name ?? "Select project"} in {workspaceName}
              </span>
            </>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-3">
                <ProjectAvatar project={activeProject} />
                <div className="grid min-w-0 gap-0.5">
                  <span className="truncate text-sm font-semibold tracking-[-0.02em] text-foreground">
                    {activeProject?.name ?? "Select project"}
                  </span>
                  <span className="truncate text-[11px] text-sidebar-muted">{projectMeta}</span>
                </div>
              </div>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={compact ? "right" : "bottom"}
        align={compact ? "start" : "end"}
        className="min-w-[17rem]"
      >
        <div className="px-3 pb-2 pt-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sidebar-muted">Workspace</p>
          <p className="mt-1 truncate text-sm font-semibold tracking-[-0.02em] text-foreground">
            {workspaceName}
          </p>
        </div>
        <div className="grid gap-1 px-1 pb-2">
          {projects.map((project) => {
            const selected = project.id === activeProjectId;
            const meta = project.website?.trim() || project.brand_name?.trim() || "Project";

            return (
              <DropdownMenuItem
                key={project.id}
                className={cn(
                  "justify-between rounded-[1rem] px-3 py-2.5",
                  selected
                    ? "bg-[linear-gradient(180deg,rgba(215,237,247,0.92),rgba(201,230,242,0.86))] text-accent-foreground"
                    : "",
                )}
                onSelect={() => {
                  if (selected) {
                    return;
                  }

                  startTransition(async () => {
                    const response = await fetch("/api/projects/active", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ projectId: project.id }),
                    });

                    if (!response.ok) {
                      const payload = await response.json().catch(() => null);
                      toast.error(payload?.error ?? "Failed to switch project");
                      return;
                    }

                    router.refresh();
                  });
                }}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <ProjectAvatar project={project} compact />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground">{project.name}</span>
                    <span className="truncate text-[11px] text-muted-foreground">{meta}</span>
                  </span>
                </span>
                {selected ? <Check className="size-4 text-accent-foreground" /> : null}
              </DropdownMenuItem>
            );
          })}
        </div>
        <div className="mt-1 grid gap-1 border-t border-white/70 px-1 pt-2">
          <DropdownMenuItem asChild className="rounded-[1rem] px-3 py-2.5">
            <Link href="/settings/projects?create=1" className="justify-between">
              <span>Create project</span>
              <FolderPlus className="size-4 text-muted-foreground" />
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="rounded-[1rem] px-3 py-2.5">
            <Link href="/settings/projects">Manage projects</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="rounded-[1rem] px-3 py-2.5">
            <Link href="/settings" className="justify-between">
              <span>Workspace settings</span>
              <Settings2 className="size-4 text-muted-foreground" />
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
