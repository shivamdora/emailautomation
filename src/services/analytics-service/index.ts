import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  mapInboxThreadDetail,
  mapInboxThreadSummary,
  type InboxThreadMessage,
} from "@/lib/inbox/threads";
import { requireSupabaseConfiguration } from "@/lib/supabase/env";
import { isMissingColumnResult } from "@/lib/utils/supabase-schema";

export async function getDashboardMetrics(workspaceId: string, options?: { projectId?: string }) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const workspaceCampaignContacts = () => {
    let query = supabase
      .from("campaign_contacts")
      .select("id, campaign:campaigns!inner(workspace_id, project_id)", { count: "exact", head: true })
      .eq("campaign.workspace_id", workspaceId);

    if (options?.projectId) {
      query = query.eq("campaign.project_id", options.projectId);
    }

    return query;
  };
  const workspaceOutboundMessages = () => {
    let query = supabase
      .from("outbound_messages")
      .select(
        "id, campaign_contact:campaign_contacts!inner(campaign:campaigns!inner(workspace_id, project_id))",
        { count: "exact", head: true },
      )
      .eq("campaign_contact.campaign.workspace_id", workspaceId)
      .eq("status", "sent");

    if (options?.projectId) {
      query = query.eq("campaign_contact.campaign.project_id", options.projectId);
    }

    return query;
  };
  const contactsQuery = supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  const unsubscribedQuery = supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .not("unsubscribed_at", "is", null);

  if (options?.projectId) {
    contactsQuery.eq("project_id", options.projectId);
    unsubscribedQuery.eq("project_id", options.projectId);
  }

  const [
    { count: totalLeads },
    { count: queued },
    { count: sent },
    { count: followupSent },
    { count: replied },
    { count: unsubscribed },
    { count: failed },
  ] = await Promise.all([
    contactsQuery,
    workspaceCampaignContacts().eq("status", "queued"),
    workspaceOutboundMessages().eq("step_number", 1),
    workspaceOutboundMessages().eq("step_number", 2),
    workspaceCampaignContacts().eq("status", "replied"),
    unsubscribedQuery,
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

export async function getReplyRateByCampaign(workspaceId: string, options?: { projectId?: string }) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("campaigns")
    .select("id, name, campaign_contacts(status, outbound_messages(step_number, status))")
    .eq("workspace_id", workspaceId);

  if (options?.projectId) {
    query = query.eq("project_id", options.projectId);
  }

  const { data, error } = await query;

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

export async function listThreads(workspaceId: string, options?: { projectId?: string }) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  let baseQuery = supabase
    .from("message_threads")
    .select(
      "id, gmail_thread_id, subject, snippet, latest_message_at, campaign_contact_id, campaign_contact:campaign_contacts(status, reply_disposition), thread_messages(id, direction, from_email, to_emails, subject, body_text, body_html, sent_at)",
    )
    .eq("workspace_id", workspaceId);

  if (options?.projectId) {
    baseQuery = baseQuery.eq("project_id", options.projectId);
  }

  let result = await baseQuery.order("latest_message_at", { ascending: false }).limit(20);

  if (isMissingColumnResult(result, "campaign_contacts", "reply_disposition")) {
    let fallbackQuery = supabase
      .from("message_threads")
      .select(
        "id, gmail_thread_id, subject, snippet, latest_message_at, campaign_contact_id, campaign_contact:campaign_contacts(status), thread_messages(id, direction, from_email, to_emails, subject, body_text, body_html, sent_at)",
      )
      .eq("workspace_id", workspaceId);

    if (options?.projectId) {
      fallbackQuery = fallbackQuery.eq("project_id", options.projectId);
    }

    result = await fallbackQuery.order("latest_message_at", { ascending: false }).limit(20);
  }

  const { data, error } = result;

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    id: string;
    subject: string | null;
    snippet: string | null;
    latest_message_at: string | null;
    campaign_contact_id?: string | null;
    campaign_contact?: { status?: string | null; reply_disposition?: string | null } | null;
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
    campaign_contact_id: thread.campaign_contact_id ?? null,
    campaign_status: thread.campaign_contact?.status ?? null,
    reply_disposition: thread.campaign_contact?.reply_disposition ?? null,
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

type RawInboxThreadRecord = {
  id: string;
  subject: string | null;
  latest_message_at: string | null;
  campaign_contact_id?: string | null;
  campaign_contact?: { status?: string | null; reply_disposition?: string | null } | null;
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
};

type InboxQueryError = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
} | null;

type InboxRangeResult = Promise<{ data: unknown; error: InboxQueryError; status?: number | null }>;
type InboxSingleResult = Promise<{ data: unknown; error: InboxQueryError; status?: number | null }>;

type InboxThreadsListQuery = {
  eq: (column: string, value: string) => InboxThreadsListQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => { range: (from: number, to: number) => InboxRangeResult };
};

type InboxThreadDetailQuery = {
  eq: (column: string, value: string) => InboxThreadDetailQuery;
  maybeSingle: () => InboxSingleResult;
};

const inboxThreadsSelect =
  "id, subject, latest_message_at, campaign_contact_id, campaign_contact:campaign_contacts(status, reply_disposition), thread_messages(id, direction, from_email, to_emails, subject, body_text, body_html, sent_at)";

function createInboxThreadsListQuery(workspaceId: string, projectId?: string) {
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("message_threads")
    .select(inboxThreadsSelect)
    .eq("workspace_id", workspaceId) as unknown as InboxThreadsListQuery;

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  return query;
}

function createInboxThreadDetailQuery(workspaceId: string, threadId: string, projectId?: string) {
  let query = createAdminSupabaseClient()
    .from("message_threads")
    .select(inboxThreadsSelect)
    .eq("workspace_id", workspaceId)
    .eq("id", threadId) as unknown as InboxThreadDetailQuery;

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  return query;
}

function mapRawInboxThread(thread: RawInboxThreadRecord) {
  return {
    id: thread.id,
    subject: thread.subject,
    latest_message_at: thread.latest_message_at,
    campaign_contact_id: thread.campaign_contact_id ?? null,
    campaign_status: thread.campaign_contact?.status ?? null,
    reply_disposition: thread.campaign_contact?.reply_disposition ?? null,
    messages:
      ((thread.thread_messages as InboxThreadMessage[] | null) ?? []).map((message) => ({
        ...message,
        body_html: message.body_html ?? null,
      })),
  };
}

export async function listInboxThreadSummaries(
  workspaceId: string,
  options?: { projectId?: string; limit?: number; offset?: number },
) {
  requireSupabaseConfiguration();

  const limit = Math.max(1, Math.min(options?.limit ?? 10, 50));
  const offset = Math.max(0, options?.offset ?? 0);
  let result = await createInboxThreadsListQuery(workspaceId, options?.projectId)
    .order("latest_message_at", { ascending: false })
    .range(offset, offset + limit);

  if (isMissingColumnResult(result, "campaign_contacts", "reply_disposition")) {
    let fallbackQuery = createAdminSupabaseClient()
      .from("message_threads")
      .select(
        "id, subject, latest_message_at, campaign_contact_id, campaign_contact:campaign_contacts(status), thread_messages(id, direction, from_email, to_emails, subject, body_text, body_html, sent_at)",
      )
      .eq("workspace_id", workspaceId) as unknown as InboxThreadsListQuery;

    if (options?.projectId) {
      fallbackQuery = fallbackQuery.eq("project_id", options.projectId);
    }

    result = await fallbackQuery.order("latest_message_at", { ascending: false }).range(offset, offset + limit);
  }

  const { data, error } = result;

  if (error) {
    throw error;
  }

  const threads = ((data ?? []) as RawInboxThreadRecord[]).map((thread) =>
    mapInboxThreadSummary(mapRawInboxThread(thread)),
  );

  return {
    threads: threads.slice(0, limit),
    hasMore: threads.length > limit,
  };
}

export async function getInboxThreadDetail(
  workspaceId: string,
  threadId: string,
  options?: { projectId?: string },
) {
  requireSupabaseConfiguration();

  let result = await createInboxThreadDetailQuery(workspaceId, threadId, options?.projectId).maybeSingle();

  if (isMissingColumnResult(result, "campaign_contacts", "reply_disposition")) {
    let fallbackQuery = createAdminSupabaseClient()
      .from("message_threads")
      .select(
        "id, subject, latest_message_at, campaign_contact_id, campaign_contact:campaign_contacts(status), thread_messages(id, direction, from_email, to_emails, subject, body_text, body_html, sent_at)",
      )
      .eq("workspace_id", workspaceId)
      .eq("id", threadId) as unknown as InboxThreadDetailQuery;

    if (options?.projectId) {
      fallbackQuery = fallbackQuery.eq("project_id", options.projectId);
    }

    result = await fallbackQuery.maybeSingle();
  }

  const { data, error } = result;

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapInboxThreadDetail(mapRawInboxThread(data as RawInboxThreadRecord));
}
