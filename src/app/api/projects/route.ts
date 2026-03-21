import { NextResponse } from "next/server";
import { invalidateProjectReadModels } from "@/lib/cache/invalidation";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { createProject } from "@/services/project-service";

function redirectTo(url: URL, searchParams: Record<string, string>) {
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();
  const contentType = request.headers.get("content-type") ?? "";
  const body =
    contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());

  const name = String(body.name ?? "").trim();

  if (!name) {
    if (contentType.includes("application/json")) {
      return NextResponse.json({ error: "Project name is required." }, { status: 400 });
    }

    return redirectTo(new URL("/settings/projects", request.url), {
      status: "error",
      message: "Project name is required.",
    });
  }

  try {
    const project = await createProject({
      workspaceId: workspace.workspaceId,
      userId: workspace.userId,
      name,
      website: String(body.website ?? "").trim() || null,
      brandName: String(body.brandName ?? "").trim() || null,
      senderDisplayName: String(body.senderDisplayName ?? "").trim() || null,
      senderTitle: String(body.senderTitle ?? "").trim() || null,
      senderSignature: String(body.senderSignature ?? "").trim() || null,
      logoUrl: String(body.logoUrl ?? "").trim() || null,
    });
    await invalidateProjectReadModels(
      {
        userId: workspace.userId,
        workspaceId: workspace.workspaceId,
        projectId: project.id,
      },
      { includeShell: true, includeWorkspace: true },
    );

    if (contentType.includes("application/json")) {
      return NextResponse.json(project);
    }

    return redirectTo(new URL("/settings/projects", request.url), {
      status: "created",
      projectId: project.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project.";

    if (contentType.includes("application/json")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return redirectTo(new URL("/settings/projects", request.url), {
      status: "error",
      message,
    });
  }
}
