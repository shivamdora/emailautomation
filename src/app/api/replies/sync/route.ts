import { NextResponse } from "next/server";
import { invalidateProjectReadModels } from "@/lib/cache/invalidation";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { syncWorkspaceReplies } from "@/services/gmail-service";

export async function POST() {
  try {
    const workspace = await getWorkspaceContext();
    const result = await syncWorkspaceReplies(workspace.workspaceId, workspace.activeProjectId);
    await invalidateProjectReadModels(
      {
        userId: workspace.userId,
        workspaceId: workspace.workspaceId,
        projectId: workspace.activeProjectId,
      },
      { includeWorkspace: true, includeInbox: true },
    );

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not sync replies for this workspace.";
    const status = message === "No authenticated user session." ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
