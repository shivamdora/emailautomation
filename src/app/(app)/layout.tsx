import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { requireSupabaseConfiguration } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  requireSupabaseConfiguration();
  let workspace: Awaited<ReturnType<typeof getWorkspaceContext>>;

  try {
    workspace = await getWorkspaceContext();
  } catch (error) {
    if (error instanceof Error && error.message === "No authenticated user session.") {
      redirect("/sign-in");
    }

    throw error;
  }

  return <AppShell brandSubtitle={workspace.workspaceLabel}>{children}</AppShell>;
}
