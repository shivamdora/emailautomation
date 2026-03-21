import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { approveGmailAccount } from "@/services/gmail-service";
import { logActivity } from "@/services/activity-log-service";
import { emitWorkspaceIntegrationEvent } from "@/services/integration-event-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Workspace admin access is required." }, { status: 403 });
  }

  const formData = await request.formData();
  const gmailAccountId = String(formData.get("gmailAccountId") ?? "");
  const approvalStatus = String(formData.get("approvalStatus") ?? "") as "approved" | "rejected";
  const approvalNote = String(formData.get("approvalNote") ?? "");

  if (!gmailAccountId || !["approved", "rejected"].includes(approvalStatus)) {
    return NextResponse.json({ error: "Invalid approval request." }, { status: 400 });
  }

  await approveGmailAccount({
    workspaceId: workspace.workspaceId,
    gmailAccountId,
    actorUserId: workspace.userId,
    approvalStatus,
    approvalNote,
  });

  await logActivity({
    workspaceId: workspace.workspaceId,
    actorUserId: workspace.userId,
    action: `gmail.${approvalStatus}`,
    targetType: "gmail_account",
    targetId: gmailAccountId,
    metadata: { approvalNote: approvalNote || null },
  });

  if (approvalStatus === "approved") {
    await emitWorkspaceIntegrationEvent({
      workspaceId: workspace.workspaceId,
      eventType: "mailbox.approved",
      summary: "A sender mailbox was approved.",
      metadata: {
        gmailAccountId,
        approvalNote: approvalNote || null,
      },
    });
  }

  return NextResponse.redirect(new URL("/settings/sending", request.url), { status: 303 });
}
