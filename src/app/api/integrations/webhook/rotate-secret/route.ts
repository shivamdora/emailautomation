import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { rotateWebhookWorkspaceIntegrationSecret } from "@/services/workspace-integration-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can rotate webhook secrets." }, { status: 403 });
  }

  const result = await rotateWebhookWorkspaceIntegrationSecret(workspace.workspaceId);
  return NextResponse.redirect(
    new URL(
      `/settings/integrations?integrationSecret=${encodeURIComponent(result.signingSecret)}&integrationSecretProvider=webhook`,
      request.url,
    ),
    { status: 303 },
  );
}
