import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { syncWorkspaceReplies } from "@/services/gmail-service";

export async function POST() {
  try {
    const workspace = await getWorkspaceContext();
    const result = await syncWorkspaceReplies(workspace.workspaceId, workspace.activeProjectId);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not sync replies for this workspace.";
    const status = message === "No authenticated user session." ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
