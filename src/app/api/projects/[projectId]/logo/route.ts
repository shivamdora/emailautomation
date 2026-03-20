import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { uploadProjectLogo } from "@/services/project-service";

type RouteParams = {
  params: Promise<{ projectId: string }>;
};

function redirectTo(url: URL, searchParams: Record<string, string>) {
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url);
}

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

    return redirectTo(new URL("/settings/projects", request.url), {
      status: "logo-updated",
      projectId: result.projectId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project logo.";
    return redirectTo(new URL("/settings/projects", request.url), {
      status: "error",
      message,
    });
  }
}
