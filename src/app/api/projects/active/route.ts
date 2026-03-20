import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { setActiveProject } from "@/services/project-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();
  const contentType = request.headers.get("content-type") ?? "";
  const body =
    contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  const projectId = String(body.projectId ?? "");

  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  }

  try {
    const result = await setActiveProject({
      workspaceId: workspace.workspaceId,
      userId: workspace.userId,
      projectId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to switch project.";
    return NextResponse.json({ error: message }, { status: /denied/i.test(message) ? 403 : 500 });
  }
}
