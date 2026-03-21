import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { disconnectCrmConnection } from "@/services/crm-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can disconnect CRM providers." }, { status: 403 });
  }

  const formData = await request.formData();
  const connectionId = String(formData.get("connectionId") ?? "").trim();

  if (!connectionId) {
    return NextResponse.json({ error: "CRM connection ID is required." }, { status: 400 });
  }

  await disconnectCrmConnection(workspace.workspaceId, connectionId);
  return NextResponse.redirect(new URL("/settings/integrations", request.url), { status: 303 });
}
