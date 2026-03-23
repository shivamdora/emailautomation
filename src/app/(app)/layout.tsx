import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AppShell } from "@/components/layout/app-shell";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { requireSupabaseConfiguration } from "@/lib/supabase/env";

export default async function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  requireSupabaseConfiguration();
  await connection();
  let workspace: Awaited<ReturnType<typeof getWorkspaceContext>>;

  try {
    workspace = await getWorkspaceContext();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === "object" && "message" in error && typeof error.message === "string"
          ? error.message
          : "Failed to load the protected app.";

    if (message === "No authenticated user session.") {
      redirect("/sign-in");
    }

    throw new Error(message);
  }

  return (
    <AppShell
      activeProjectId={workspace.activeProjectId}
      projects={workspace.availableProjects}
      shellTitle={workspace.workspaceLabel}
      workspaceName={workspace.workspaceName}
    >
      {children}
    </AppShell>
  );
}
