import { NextResponse } from "next/server";
import { invalidateProjectReadModels } from "@/lib/cache/invalidation";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { inboxReplySchema } from "@/lib/zod/schemas";
import { sendReplyToThread } from "@/services/gmail-service";
import { logActivity } from "@/services/activity-log-service";

export async function POST(request: Request) {
  const payload = inboxReplySchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  const workspace = await getWorkspaceContext();
  const result = await sendReplyToThread(payload.data);

  await logActivity({
    workspaceId: workspace.workspaceId,
    actorUserId: workspace.userId,
    action: "thread.reply_sent",
    targetType: "message_thread",
    targetId: payload.data.threadRecordId,
    metadata: { gmailMessageId: result.gmailMessageId, recipientEmail: result.recipientEmail },
  });
  await invalidateProjectReadModels(
    {
      userId: workspace.userId,
      workspaceId: workspace.workspaceId,
      projectId: workspace.activeProjectId,
    },
    {
      includeWorkspace: true,
      includeInbox: true,
      threadId: payload.data.threadRecordId,
    },
  );

  return NextResponse.json(result);
}
