import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { processCrmPushJobs, syncCrmConnection, syncWorkspaceCrmConnections } from "@/services/crm-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can sync CRM providers." }, { status: 403 });
  }

  const formData = await request.formData();
  const connectionId = String(formData.get("connectionId") ?? "").trim();

  if (connectionId) {
    await syncCrmConnection(connectionId);
  } else {
    await syncWorkspaceCrmConnections(workspace.workspaceId);
  }

  await processCrmPushJobs(workspace.workspaceId);

  return NextResponse.redirect(new URL("/settings", request.url), { status: 303 });
}
