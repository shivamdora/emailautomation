import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { refreshWorkspaceUsageCounters } from "@/services/entitlement-service";
import { updateWorkspaceBillingAccount } from "@/services/billing-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can update billing settings." }, { status: 403 });
  }

  const formData = await request.formData();
  const planKey = String(formData.get("planKey") ?? "").trim();
  const status = String(formData.get("status") ?? "active").trim() || "active";
  const renewalAt = String(formData.get("renewalAt") ?? "").trim();

  if (!planKey) {
    return NextResponse.json({ error: "Plan key is required." }, { status: 400 });
  }

  const usageSnapshot = await refreshWorkspaceUsageCounters(workspace.workspaceId);
  await updateWorkspaceBillingAccount({
    workspaceId: workspace.workspaceId,
    actorUserId: workspace.userId,
    planKey,
    status,
    renewalAt: renewalAt || null,
    usageSnapshot,
  });

  return NextResponse.redirect(new URL("/settings/advanced", request.url), { status: 303 });
}
