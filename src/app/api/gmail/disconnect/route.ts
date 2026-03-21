import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { disconnectMailbox } from "@/services/gmail-service";
import { logActivity } from "@/services/activity-log-service";

export async function POST(request: Request) {
  const formData = await request.formData();
  const gmailAccountId = String(formData.get("gmailAccountId") ?? "");
  const workspace = await getWorkspaceContext();

  await disconnectMailbox(workspace.workspaceId, gmailAccountId);
  await logActivity({
    workspaceId: workspace.workspaceId,
    actorUserId: workspace.userId,
    action: "gmail.disconnected",
    targetType: "gmail_account",
    targetId: gmailAccountId,
  });

  return NextResponse.redirect(new URL("/settings/sending?gmail=disconnected", request.url), {
    status: 303,
  });
}
