import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { getInboxThreadDetail } from "@/services/analytics-service";

type RouteParams = {
  params: Promise<{ threadId: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { threadId } = await params;
    const workspace = await getWorkspaceContext();
    const thread = await getInboxThreadDetail(workspace.workspaceId, threadId, {
      projectId: workspace.activeProjectId,
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }

    return NextResponse.json(thread);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load thread detail." },
      { status: 500 },
    );
  }
}
