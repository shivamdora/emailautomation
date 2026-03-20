import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { updateProject } from "@/services/project-service";

type RouteParams = {
  params: Promise<{ projectId: string }>;
};

function redirectTo(url: URL, searchParams: Record<string, string>) {
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { projectId } = await params;
  const workspace = await getWorkspaceContext();
  const contentType = request.headers.get("content-type") ?? "";
  const body =
    contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  const name = String(body.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  }

  try {
    const project = await updateProject({
      workspaceId: workspace.workspaceId,
      projectId,
      name,
      website: String(body.website ?? "").trim() || null,
      brandName: String(body.brandName ?? "").trim() || null,
      senderDisplayName: String(body.senderDisplayName ?? "").trim() || null,
      senderTitle: String(body.senderTitle ?? "").trim() || null,
      senderSignature: String(body.senderSignature ?? "").trim() || null,
      logoUrl: String(body.logoUrl ?? "").trim() || null,
    });

    return NextResponse.json(project);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { projectId } = await params;
  const workspace = await getWorkspaceContext();
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return redirectTo(new URL("/settings/projects", request.url), {
      status: "error",
      message: "Project name is required.",
    });
  }

  try {
    await updateProject({
      workspaceId: workspace.workspaceId,
      projectId,
      name,
      website: String(formData.get("website") ?? "").trim() || null,
      brandName: String(formData.get("brandName") ?? "").trim() || null,
      senderDisplayName: String(formData.get("senderDisplayName") ?? "").trim() || null,
      senderTitle: String(formData.get("senderTitle") ?? "").trim() || null,
      senderSignature: String(formData.get("senderSignature") ?? "").trim() || null,
      logoUrl: String(formData.get("logoUrl") ?? "").trim() || null,
    });

    return redirectTo(new URL("/settings/projects", request.url), {
      status: "updated",
      projectId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project.";
    return redirectTo(new URL("/settings/projects", request.url), {
      status: "error",
      message,
    });
  }
}
