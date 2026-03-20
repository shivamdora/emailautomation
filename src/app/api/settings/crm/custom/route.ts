import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import {
  createCustomCrmConnection,
  rotateCustomCrmApiKey,
  updateCustomCrmWebhook,
} from "@/services/crm-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can manage Custom CRM." }, { status: 403 });
  }

  const formData = await request.formData();
  const action = String(formData.get("action") ?? "create").trim();
  const connectionId = String(formData.get("connectionId") ?? "").trim();

  if (action === "rotate_key") {
    if (!connectionId) {
      return NextResponse.json({ error: "CRM connection ID is required." }, { status: 400 });
    }

    const result = await rotateCustomCrmApiKey({
      workspaceId: workspace.workspaceId,
      connectionId,
    });
    return NextResponse.redirect(
      new URL(`/settings?crmKey=${encodeURIComponent(result.inboundApiKey)}`, request.url),
      { status: 303 },
    );
  }

  if (action === "update_webhook") {
    if (!connectionId) {
      return NextResponse.json({ error: "CRM connection ID is required." }, { status: 400 });
    }

    await updateCustomCrmWebhook({
      workspaceId: workspace.workspaceId,
      connectionId,
      outboundWebhookUrl: String(formData.get("outboundWebhookUrl") ?? ""),
    });

    return NextResponse.redirect(new URL("/settings", request.url), { status: 303 });
  }

  const providerAccountLabel = String(formData.get("providerAccountLabel") ?? "").trim() || "Custom CRM";
  const outboundWebhookUrl = String(formData.get("outboundWebhookUrl") ?? "").trim();
  const result = await createCustomCrmConnection({
    workspaceId: workspace.workspaceId,
    actorUserId: workspace.userId,
    providerAccountLabel,
    outboundWebhookUrl,
  });

  return NextResponse.redirect(
    new URL(
      `/settings?crmKey=${encodeURIComponent(result.inboundApiKey)}&crmWebhookSecret=${encodeURIComponent(result.webhookSigningSecret)}`,
      request.url,
    ),
    { status: 303 },
  );
}
