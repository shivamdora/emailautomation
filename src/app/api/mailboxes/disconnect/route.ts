import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { logActivity } from "@/services/activity-log-service";
import { disconnectMailbox } from "@/services/mailbox-service";

export async function POST(request: Request) {
  const formData = await request.formData();
  const mailboxAccountId = String(formData.get("mailboxAccountId") ?? "");
  const provider = String(formData.get("provider") ?? "").trim().toLowerCase() || null;
  const workspace = await getWorkspaceContext();

  if (!mailboxAccountId) {
    return NextResponse.json({ error: "Mailbox account is required." }, { status: 400 });
  }

  await disconnectMailbox(workspace.workspaceId, mailboxAccountId);
  await logActivity({
    workspaceId: workspace.workspaceId,
    actorUserId: workspace.userId,
    action: provider ? `${provider}.disconnected` : "mailbox.disconnected",
    targetType: "mailbox_account",
    targetId: mailboxAccountId,
    metadata: { provider },
  });

  const redirectUrl = new URL("/settings/sending?mailbox=disconnected", request.url);

  if (provider) {
    redirectUrl.searchParams.set("provider", provider);
  }

  return NextResponse.redirect(redirectUrl, {
    status: 303,
  });
}
