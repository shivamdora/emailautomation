import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/crypto/tokens";
import { requireSupabaseConfiguration } from "@/lib/supabase/env";
import { cancelPendingCampaignJobs } from "@/services/campaign-send-queue-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const tokenHash = hashToken(token);
  const { data: rawUnsubscribe } = await supabase
    .from("unsubscribes")
    .select("id, contact_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  const data = rawUnsubscribe as { id: string; contact_id: string } | null;

  if (!data) {
    return NextResponse.json({ error: "Invalid unsubscribe token" }, { status: 404 });
  }

  await supabase
    .from("contacts")
    .update({ unsubscribed_at: new Date().toISOString() } as never)
    .eq("id", data.contact_id);

  const { data: rawCampaignContacts } = await supabase
    .from("campaign_contacts")
    .select("id")
    .eq("contact_id", data.contact_id);
  const campaignContacts = (rawCampaignContacts ?? []) as Array<{ id: string }>;

  if (campaignContacts.length) {
    await supabase
      .from("campaign_contacts")
      .update({
        status: "unsubscribed",
        next_due_at: null,
      } as never)
      .eq("contact_id", data.contact_id);

    for (const campaignContact of campaignContacts) {
      await cancelPendingCampaignJobs(campaignContact.id, {
        reason: "Recipient unsubscribed",
      });
    }
  }

  return new NextResponse(
    "<html><body style='font-family:sans-serif;padding:40px'>You have been unsubscribed.</body></html>",
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}
