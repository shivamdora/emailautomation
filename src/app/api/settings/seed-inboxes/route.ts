import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { createSeedInboxRecord, updateSeedInboxRecord } from "@/services/seed-monitor-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can manage seed inboxes." }, { status: 403 });
  }

  const formData = await request.formData();
  const action = String(formData.get("action") ?? "save").trim();
  const inboxId = String(formData.get("seedInboxId") ?? "").trim();
  const provider = String(formData.get("provider") ?? "").trim();
  const emailAddress = String(formData.get("emailAddress") ?? "").trim().toLowerCase();
  const status = String(formData.get("status") ?? "active").trim() || "active";
  const monitoringEnabled = String(formData.get("monitoringEnabled") ?? "").trim();

  if (inboxId) {
    await updateSeedInboxRecord({
      workspaceId: workspace.workspaceId,
      seedInboxId: inboxId,
      status,
      monitoringEnabled:
        action === "toggle_monitoring"
          ? monitoringEnabled === "true"
          : undefined,
    });

    return NextResponse.redirect(new URL("/settings/advanced", request.url), { status: 303 });
  }

  if (!provider || !emailAddress) {
    return NextResponse.json({ error: "Provider and email address are required." }, { status: 400 });
  }

  await createSeedInboxRecord({
    workspaceId: workspace.workspaceId,
    provider,
    emailAddress,
    status,
  });

  return NextResponse.redirect(new URL("/settings/advanced", request.url), { status: 303 });
}
