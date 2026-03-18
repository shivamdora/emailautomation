import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireSupabaseConfiguration } from "@/lib/supabase/env";

export async function getDashboardMetrics(workspaceId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const workspaceCampaignContacts = () =>
    supabase
      .from("campaign_contacts")
      .select("id, campaign:campaigns!inner(workspace_id)", { count: "exact", head: true })
      .eq("campaign.workspace_id", workspaceId);
  const workspaceOutboundMessages = () =>
    supabase
      .from("outbound_messages")
      .select(
        "id, campaign_contact:campaign_contacts!inner(campaign:campaigns!inner(workspace_id))",
        { count: "exact", head: true },
      )
      .eq("campaign_contact.campaign.workspace_id", workspaceId)
      .eq("status", "sent");
  const [
    { count: totalLeads },
    { count: queued },
    { count: sent },
    { count: followupSent },
    { count: replied },
    { count: unsubscribed },
    { count: failed },
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    workspaceCampaignContacts().eq("status", "queued"),
    workspaceOutboundMessages().eq("step_number", 1),
    workspaceOutboundMessages().eq("step_number", 2),
    workspaceCampaignContacts().eq("status", "replied"),
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .not("unsubscribed_at", "is", null),
    workspaceCampaignContacts().eq("status", "failed"),
  ]);

  const sentCount = sent ?? 0;
  const repliedCount = replied ?? 0;

  return {
    totalLeads: totalLeads ?? 0,
    queued: queued ?? 0,
    sent: sentCount,
    followupSent: followupSent ?? 0,
    replied: repliedCount,
    unsubscribed: unsubscribed ?? 0,
    failed: failed ?? 0,
    replyRate: sentCount ? Number(((repliedCount / sentCount) * 100).toFixed(1)) : 0,
  };
}

export async function getReplyRateByCampaign(workspaceId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, campaign_contacts(status, outbound_messages(step_number, status))")
    .eq("workspace_id", workspaceId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    name: string;
    campaign_contacts:
      | Array<{
          status: string;
          outbound_messages?: Array<{ step_number: number; status: string }> | null;
        }>
      | null;
  }>).map((campaign) => {
    const contacts = campaign.campaign_contacts ?? [];
    const sent = contacts.filter((contact) =>
      (contact.outbound_messages ?? []).some(
        (message) => message.step_number === 1 && message.status === "sent",
      ),
    ).length;
    const replied = contacts.filter((contact) => contact.status === "replied").length;

    return {
      name: campaign.name,
      replyRate: sent ? Number(((replied / sent) * 100).toFixed(1)) : 0,
    };
  });
}

export async function listThreads(workspaceId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("message_threads")
    .select(
      "id, gmail_thread_id, subject, snippet, latest_message_at, thread_messages(id, direction, from_email, to_emails, subject, body_text, body_html, sent_at)",
    )
    .eq("workspace_id", workspaceId)
    .order("latest_message_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    id: string;
    subject: string | null;
    snippet: string | null;
    latest_message_at: string | null;
      thread_messages: Array<{
        id: string;
        direction: string;
        from_email: string | null;
        to_emails: string[] | null;
        subject: string | null;
        body_text: string | null;
        body_html: string | null;
        sent_at: string;
      }> | null;
  }>).map((thread) => ({
    id: thread.id,
    subject: thread.subject,
    snippet: thread.snippet,
    latest_message_at: thread.latest_message_at,
    messages:
      ((thread.thread_messages as Array<{
        id: string;
        direction: string;
        from_email: string | null;
        to_emails: string[] | null;
        subject: string | null;
        body_text: string | null;
        body_html: string | null;
        sent_at: string;
      }> | null) ?? []) || [],
  }));
}
