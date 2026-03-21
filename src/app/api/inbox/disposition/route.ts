import { NextResponse } from "next/server";
import { invalidateProjectReadModels } from "@/lib/cache/invalidation";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { classifyReplyDisposition } from "@/lib/utils/reply-disposition";
import { isAnyMissingColumnResult } from "@/lib/utils/supabase-schema";
import { cancelPendingCampaignJobs } from "@/services/campaign-send-queue-service";
import { recordMessageEvent } from "@/services/telemetry-service";

function resolveStatus(disposition: string) {
  if (disposition === "negative") {
    return "unsubscribed";
  }

  if (disposition === "booked") {
    return "meeting_booked";
  }

  return "replied";
}

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();
  const payload = await request.json().catch(() => null);
  const threadRecordId = String(payload?.threadRecordId ?? "");
  const requestedDisposition = String(payload?.replyDisposition ?? "");
  const replyDisposition = ["negative", "booked", "positive", "question", "other"].includes(requestedDisposition)
    ? requestedDisposition
    : classifyReplyDisposition(requestedDisposition);

  if (!threadRecordId) {
    return NextResponse.json({ error: "Thread record ID is required." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: rawThreadRecord, error } = await supabase
    .from("message_threads")
    .select("id, campaign_contact_id")
    .eq("workspace_id", workspace.workspaceId)
    .eq("id", threadRecordId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const threadRecord = rawThreadRecord as { campaign_contact_id?: string | null } | null;

  if (!threadRecord?.campaign_contact_id) {
    return NextResponse.json({ error: "Thread is not linked to a campaign contact." }, { status: 400 });
  }

  const status = resolveStatus(replyDisposition);
  const now = new Date().toISOString();
  let updateResult = await supabase
    .from("campaign_contacts")
    .update({
      status,
      reply_disposition: replyDisposition,
      exit_reason: replyDisposition === "negative" ? "manual_negative_reply" : replyDisposition === "booked" ? "manual_meeting_booked" : "manual_reply_update",
      replied_at: now,
      meeting_booked_at: replyDisposition === "booked" ? now : null,
      next_due_at: null,
    })
    .eq("id", threadRecord.campaign_contact_id);

  if (
    isAnyMissingColumnResult(updateResult, [
      { table: "campaign_contacts", column: "reply_disposition" },
      { table: "campaign_contacts", column: "meeting_booked_at" },
      { table: "campaign_contacts", column: "exit_reason" },
    ])
  ) {
    updateResult = await supabase
      .from("campaign_contacts")
      .update({
        status,
        replied_at: now,
        next_due_at: null,
      })
      .eq("id", threadRecord.campaign_contact_id);
  }

  if (updateResult.error) {
    return NextResponse.json({ error: updateResult.error.message || "Failed to update reply state." }, { status: 500 });
  }

  await cancelPendingCampaignJobs(threadRecord.campaign_contact_id, {
    reason:
      replyDisposition === "negative"
        ? "Manual negative reply update"
        : replyDisposition === "booked"
          ? "Manual meeting booked update"
          : "Manual reply update",
  });

  await recordMessageEvent({
    workspaceId: workspace.workspaceId,
    campaignContactId: threadRecord.campaign_contact_id,
    eventType: replyDisposition === "negative" ? "unsubscribed" : replyDisposition === "booked" ? "meeting_booked" : "replied",
    metadata: { manualOverride: true, replyDisposition },
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
      threadId: threadRecordId,
    },
  );

  return NextResponse.json({ ok: true, replyDisposition, status });
}
