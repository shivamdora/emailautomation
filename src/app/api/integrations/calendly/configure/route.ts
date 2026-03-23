import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { updateCalendlyWorkspaceIntegrationConfig } from "@/services/workspace-integration-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can configure Calendly." }, { status: 403 });
  }

  const formData = await request.formData();
  const signingKey = String(formData.get("signingKey") ?? "").trim();
  const eventTypes = formData.getAll("eventTypes").map((value) => String(value).trim()).filter(Boolean);

  if (!signingKey) {
    return NextResponse.json({ error: "Calendly webhook signing key is required." }, { status: 400 });
  }

  await updateCalendlyWorkspaceIntegrationConfig({
    workspaceId: workspace.workspaceId,
    signingKey,
    eventTypes,
  });

  return NextResponse.redirect(new URL("/settings/integrations", request.url), { status: 303 });
}
