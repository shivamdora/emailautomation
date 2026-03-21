import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { cancelPendingCampaignJobs } from "@/services/campaign-send-queue-service";
import { recordMessageEvent } from "@/services/telemetry-service";

export async function markMeetingBookedFromEmail(input: {
  workspaceId: string;
  email: string;
  occurredAt?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const supabase = createAdminSupabaseClient();
  const normalizedEmail = input.email.trim().toLowerCase();
  const occurredAt = input.occurredAt ?? new Date().toISOString();

  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("email", normalizedEmail)
    .maybeSingle();

  const contactId = (contact as { id?: string } | null)?.id;

  if (!contactId) {
    return { matched: false };
  }

  const { data: rawCampaignContacts, error } = await supabase
    .from("campaign_contacts")
    .select("id, status, created_at, campaign:campaigns!inner(workspace_id)")
    .eq("contact_id", contactId)
    .eq("campaign.workspace_id", input.workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const campaignContact = ((rawCampaignContacts ?? []) as Array<{
    id: string;
    status: string;
    created_at: string;
  }>).find((item) =>
    ["queued", "sent", "followup_due", "followup_sent", "replied"].includes(item.status),
  );

  if (!campaignContact) {
    return { matched: false, contactId };
  }

  await supabase
    .from("campaign_contacts")
    .update({
      status: "meeting_booked",
      replied_at: occurredAt,
      reply_disposition: "booked",
      meeting_booked_at: occurredAt,
      exit_reason: "meeting_booked",
      next_due_at: null,
      error_message: null,
    })
    .eq("id", campaignContact.id);

  await cancelPendingCampaignJobs(campaignContact.id, {
    reason: "Meeting booked from external scheduling",
  });

  await recordMessageEvent({
    workspaceId: input.workspaceId,
    campaignContactId: campaignContact.id,
    eventType: "meeting_booked",
    metadata: {
      ...(input.metadata ?? {}),
      email: normalizedEmail,
      source: "calendly",
    },
  });

  return {
    matched: true,
    contactId,
    campaignContactId: campaignContact.id,
  };
}
