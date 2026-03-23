import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { saveWebhookWorkspaceIntegration } from "@/services/workspace-integration-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can manage webhooks." }, { status: 403 });
  }

  const formData = await request.formData();
  const webhookUrl = String(formData.get("webhookUrl") ?? "").trim();
  const eventTypes = formData.getAll("eventTypes").map((value) => String(value).trim()).filter(Boolean);

  if (!webhookUrl) {
    return NextResponse.json({ error: "Webhook URL is required." }, { status: 400 });
  }

  const result = await saveWebhookWorkspaceIntegration({
    workspaceId: workspace.workspaceId,
    webhookUrl,
    eventTypes,
  });
  const redirectUrl = new URL("/settings/integrations", request.url);

  if (result.signingSecret) {
    redirectUrl.searchParams.set("integrationSecret", result.signingSecret);
    redirectUrl.searchParams.set("integrationSecretProvider", "webhook");
  }

  return NextResponse.redirect(redirectUrl, { status: 303 });
}
