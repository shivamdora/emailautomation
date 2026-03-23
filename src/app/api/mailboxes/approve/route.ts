import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { approveMailboxAccount } from "@/services/mailbox-service";
import { logActivity } from "@/services/activity-log-service";
import { emitWorkspaceIntegrationEvent } from "@/services/integration-event-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Workspace admin access is required." }, { status: 403 });
  }

  const formData = await request.formData();
  const mailboxAccountId = String(formData.get("mailboxAccountId") ?? "");
  const approvalStatus = String(formData.get("approvalStatus") ?? "") as "approved" | "rejected";
  const approvalNote = String(formData.get("approvalNote") ?? "");
  const provider = String(formData.get("provider") ?? "").trim().toLowerCase() || null;

  if (!mailboxAccountId || !["approved", "rejected"].includes(approvalStatus)) {
    return NextResponse.json({ error: "Invalid approval request." }, { status: 400 });
  }

  await approveMailboxAccount({
    workspaceId: workspace.workspaceId,
    mailboxAccountId,
    actorUserId: workspace.userId,
    approvalStatus,
    approvalNote,
  });

  await logActivity({
    workspaceId: workspace.workspaceId,
    actorUserId: workspace.userId,
    action: provider ? `${provider}.${approvalStatus}` : `mailbox.${approvalStatus}`,
    targetType: "mailbox_account",
    targetId: mailboxAccountId,
    metadata: {
      approvalNote: approvalNote || null,
      provider,
    },
  });

  if (approvalStatus === "approved") {
    await emitWorkspaceIntegrationEvent({
      workspaceId: workspace.workspaceId,
      eventType: "mailbox.approved",
      summary: "A sender mailbox was approved.",
      metadata: {
        mailboxAccountId,
        provider,
        approvalNote: approvalNote || null,
      },
    });
  }

  return NextResponse.redirect(new URL("/settings/sending", request.url), { status: 303 });
}
