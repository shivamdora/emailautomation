import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { disconnectWorkspaceIntegration } from "@/services/workspace-integration-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can disconnect integrations." }, { status: 403 });
  }

  const formData = await request.formData();
  const integrationId = String(formData.get("integrationId") ?? "").trim();

  if (!integrationId) {
    return NextResponse.json({ error: "Integration ID is required." }, { status: 400 });
  }

  await disconnectWorkspaceIntegration(workspace.workspaceId, integrationId);
  return NextResponse.redirect(new URL("/settings/integrations", request.url), { status: 303 });
}
