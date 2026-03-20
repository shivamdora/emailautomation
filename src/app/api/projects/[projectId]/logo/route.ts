import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { uploadProjectLogo } from "@/services/project-service";

type RouteParams = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { projectId } = await params;
  const workspace = await getWorkspaceContext();
  const formData = await request.formData();
  const file = formData.get("logo");
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;

  try {
    const result = await uploadProjectLogo({
      workspaceId: workspace.workspaceId,
      projectId,
      file: file instanceof File ? file : null,
      logoUrl,
    });

    return NextResponse.json({
      ok: true,
      message: "Project logo updated.",
      projectId: result.projectId,
      logoUrl: result.logoUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project logo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
