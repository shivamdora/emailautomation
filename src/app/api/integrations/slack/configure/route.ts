import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { updateSlackWorkspaceIntegrationConfig } from "@/services/workspace-integration-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can configure Slack." }, { status: 403 });
  }

  const formData = await request.formData();
  const channelId = String(formData.get("channelId") ?? "").trim();
  const eventTypes = formData.getAll("eventTypes").map((value) => String(value).trim()).filter(Boolean);

  if (!channelId) {
    return NextResponse.json({ error: "Slack channel ID is required." }, { status: 400 });
  }

  await updateSlackWorkspaceIntegrationConfig({
    workspaceId: workspace.workspaceId,
    channelId,
    eventTypes,
  });

  return NextResponse.redirect(new URL("/settings/integrations", request.url), { status: 303 });
}
