import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { listInboxThreadSummaries } from "@/services/analytics-service";

export async function GET(request: Request) {
  try {
    const workspace = await getWorkspaceContext();
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "10");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const result = await listInboxThreadSummaries(workspace.workspaceId, {
      projectId: workspace.activeProjectId,
      limit: Number.isFinite(limit) ? limit : 10,
      offset: Number.isFinite(offset) ? offset : 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load inbox threads." },
      { status: 500 },
    );
  }
}
