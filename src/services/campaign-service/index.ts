import "server-only";
import { addDays } from "date-fns";
import { createHash, randomUUID } from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env, requireSupabaseConfiguration } from "@/lib/supabase/env";
import { escapeHtml, normalizeEmailHtmlDocument, stripHtmlToText } from "@/lib/utils/html";
import { renderTemplate } from "@/lib/utils/template";
import { isWithinSendWindow } from "@/lib/utils/time";
import { getMailboxAccessTokenForAccount, sendWithMailboxProvider } from "@/services/gmail-service";

type CampaignStepInput = {
  subject: string;
  mode: "text" | "html";
  body?: string | null;
  bodyHtml?: string | null;
};

type StoredCampaignStep = {
  step_number: number;
  subject_template: string;
  body_template: string;
  body_html_template?: string | null;
  wait_days?: number | null;
  step_type?: "initial" | "follow_up";
};

type CampaignContactContext = {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  website?: string | null;
  job_title?: string | null;
  custom_fields_jsonb?: Record<string, unknown> | null;
  unsubscribed_at?: string | null;
};

function isCampaignSchemaCacheError(error: { message?: string | null; details?: string | null; hint?: string | null } | null | undefined) {
  const parts = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return (
    parts.includes("schema cache") ||
    parts.includes("could not find the column") ||
    parts.includes("body_html_template")
  );
}

function buildUnsubscribeLink(token: string) {
  return `${env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/unsubscribes/${token}`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeStepInput(step: CampaignStepInput) {
  const bodyHtml = step.mode === "html" ? step.bodyHtml?.trim() || null : null;
  const fallbackText =
    step.mode === "html"
      ? step.body?.trim() || (bodyHtml ? stripHtmlToText(bodyHtml) : "")
      : step.body?.trim() || "";

  return {
    subject_template: step.subject.trim(),
    body_template: fallbackText,
    body_html_template: bodyHtml,
  };
}

function appendUnsubscribeHtml(htmlBody: string, unsubscribeLink: string) {
  const normalized = normalizeEmailHtmlDocument(htmlBody);
  const unsubscribeBlock = `<div style="margin-top:24px;font-size:13px;color:#64748b;"><a href="${unsubscribeLink}">Unsubscribe</a></div>`;

  if (/<\/body>/i.test(normalized)) {
    return normalized.replace(/<\/body>/i, `${unsubscribeBlock}</body>`);
  }

  return `${normalized}${unsubscribeBlock}`;
}

function appendUnsubscribeText(textBody: string, unsubscribeLink: string) {
  return `${textBody}\n\nUnsubscribe: ${unsubscribeLink}`.trim();
}

function textBodyToHtml(textBody: string, unsubscribeLink: string) {
  return `${escapeHtml(textBody).replace(/\n/g, "<br />")}<br /><br /><a href="${unsubscribeLink}">Unsubscribe</a>`;
}

function renderCampaignStepContent(step: StoredCampaignStep, contact: CampaignContactContext, unsubscribeLink: string) {
  const renderedSubject = renderTemplate(step.subject_template, contact);
  const renderedTextBody = renderTemplate(step.body_template, contact);
  const renderedHtmlBody = step.body_html_template
    ? renderTemplate(step.body_html_template, contact)
    : null;
  const textBody = renderedTextBody || (renderedHtmlBody ? stripHtmlToText(renderedHtmlBody) : "");

  return {
    subject: renderedSubject,
    bodyText: appendUnsubscribeText(textBody, unsubscribeLink),
    bodyHtml: renderedHtmlBody
      ? appendUnsubscribeHtml(renderedHtmlBody, unsubscribeLink)
      : textBodyToHtml(textBody, unsubscribeLink),
    snippet: textBody.slice(0, 120),
  };
}

async function upsertCampaignSteps(input: {
  campaignId: string;
  primaryStep: CampaignStepInput;
  followupStep: CampaignStepInput;
}) {
  const supabase = createAdminSupabaseClient();
  const normalizedPrimary = normalizeStepInput(input.primaryStep);
  const normalizedFollowup = normalizeStepInput(input.followupStep);
  const { error } = await supabase.from("campaign_steps").upsert(
    [
      {
        campaign_id: input.campaignId,
        step_number: 1,
        step_type: "initial",
        subject_template: normalizedPrimary.subject_template,
        body_template: normalizedPrimary.body_template,
        body_html_template: normalizedPrimary.body_html_template,
        wait_days: 0,
      },
      {
        campaign_id: input.campaignId,
        step_number: 2,
        step_type: "follow_up",
        subject_template: normalizedFollowup.subject_template,
        body_template: normalizedFollowup.body_template,
        body_html_template: normalizedFollowup.body_html_template,
        wait_days: env.FOLLOW_UP_DELAY_DAYS,
      },
    ],
    { onConflict: "campaign_id,step_number" },
  );

  if (error) {
    if (isCampaignSchemaCacheError(error)) {
      if (normalizedPrimary.body_html_template || normalizedFollowup.body_html_template) {
        throw new Error(
          "HTML campaigns are not enabled in this database yet. Apply the latest Supabase migration to add campaign_steps.body_html_template before sending designed HTML emails.",
        );
      }

      const fallback = await supabase.from("campaign_steps").upsert(
        [
          {
            campaign_id: input.campaignId,
            step_number: 1,
            step_type: "initial",
            subject_template: normalizedPrimary.subject_template,
            body_template: normalizedPrimary.body_template,
            wait_days: 0,
          },
          {
            campaign_id: input.campaignId,
            step_number: 2,
            step_type: "follow_up",
            subject_template: normalizedFollowup.subject_template,
            body_template: normalizedFollowup.body_template,
            wait_days: env.FOLLOW_UP_DELAY_DAYS,
          },
        ],
        { onConflict: "campaign_id,step_number" },
      );

      if (fallback.error) {
        throw fallback.error;
      }

      return;
    }
    throw error;
  }
}

async function selectCampaignWithSteps(campaignId: string) {
  const supabase = createAdminSupabaseClient();
  let result = await supabase
    .from("campaigns")
    .select(
      "id, name, status, daily_send_limit, timezone, send_window_start, send_window_end, gmail_account_id, campaign_steps(id, step_number, step_type, subject_template, body_template, body_html_template, wait_days), campaign_contacts(id, status, current_step, next_due_at, contact_id, contact:contacts(email, first_name, company))",
    )
    .eq("id", campaignId)
    .single();

  if (result.error && isCampaignSchemaCacheError(result.error)) {
    result = await supabase
      .from("campaigns")
      .select(
        "id, name, status, daily_send_limit, timezone, send_window_start, send_window_end, gmail_account_id, campaign_steps(id, step_number, step_type, subject_template, body_template, wait_days), campaign_contacts(id, status, current_step, next_due_at, contact_id, contact:contacts(email, first_name, company))",
      )
      .eq("id", campaignId)
      .single();
  }

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

async function selectCampaignForEditing(campaignId: string, workspaceId: string) {
  const supabase = createAdminSupabaseClient();
  let result = await supabase
    .from("campaigns")
    .select(
      "id, workspace_id, name, status, gmail_account_id, daily_send_limit, timezone, send_window_start, send_window_end, campaign_steps(step_number, step_type, subject_template, body_template, body_html_template, wait_days), campaign_contacts(contact_id, status, current_step)",
    )
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .single();

  if (result.error && isCampaignSchemaCacheError(result.error)) {
    result = await supabase
      .from("campaigns")
      .select(
        "id, workspace_id, name, status, gmail_account_id, daily_send_limit, timezone, send_window_start, send_window_end, campaign_steps(step_number, step_type, subject_template, body_template, wait_days), campaign_contacts(contact_id, status, current_step)",
      )
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId)
      .single();
  }

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function listTemplates(workspaceId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  let result = await supabase
    .from("templates")
    .select("id, name, subject_template, body_template, body_html_template, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (result.error && isCampaignSchemaCacheError(result.error)) {
    result = await supabase
      .from("templates")
      .select("id, name, subject_template, body_template, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
  }

  if (result.error) {
    throw result.error;
  }

  return ((result.data ?? []) as Array<{
    id: string;
    name: string;
    subject_template: string;
    body_template: string;
    body_html_template?: string | null;
    created_at: string;
  }>).map((template) => ({
    ...template,
    body_html_template: template.body_html_template ?? null,
  }));
}

export async function saveTemplate(input: {
  workspaceId: string;
  userId: string;
  name: string;
  subjectTemplate: string;
  mode: "text" | "html";
  bodyTemplate?: string | null;
  bodyHtmlTemplate?: string | null;
}) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const normalized = normalizeStepInput({
    subject: input.subjectTemplate,
    mode: input.mode,
    body: input.bodyTemplate,
    bodyHtml: input.bodyHtmlTemplate,
  });
  const templatePayload = {
    workspace_id: input.workspaceId,
    owner_user_id: input.userId,
    name: input.name,
    subject_template: normalized.subject_template,
    body_template: normalized.body_template,
    body_html_template: normalized.body_html_template,
  };
  const { data, error } = await supabase
    .from("templates")
    .insert(templatePayload)
    .select("id")
    .single();

  if (error) {
    if (isCampaignSchemaCacheError(error)) {
      if (normalized.body_html_template) {
        throw new Error(
          "HTML templates are not enabled in this database yet. Apply the latest Supabase migration to add templates.body_html_template before saving designed templates.",
        );
      }

      const fallback = await supabase
        .from("templates")
        .insert({
          workspace_id: input.workspaceId,
          owner_user_id: input.userId,
          name: input.name,
          subject_template: normalized.subject_template,
          body_template: normalized.body_template,
        })
        .select("id")
        .single();

      if (fallback.error) {
        throw fallback.error;
      }

      return fallback.data as { id: string };
    }
    throw error;
  }

  return data as { id: string };
}

export async function listCampaigns(workspaceId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, status, daily_send_limit, timezone, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data as Array<{
    id: string;
    name: string;
    status: string;
    daily_send_limit: number;
    timezone: string;
    created_at: string;
  }>;
}

export async function getCampaignById(campaignId: string) {
  requireSupabaseConfiguration();
  const data = await selectCampaignWithSteps(campaignId);

  return data as {
    id: string;
    name: string;
    status: string;
    daily_send_limit: number;
    timezone: string;
    gmail_account_id: string;
    send_window_start?: string | null;
    send_window_end?: string | null;
    campaign_steps?: StoredCampaignStep[] | null;
    campaign_contacts?: Array<{
      id: string;
      contact_id?: string;
      status: string;
      current_step: number;
      next_due_at: string | null;
      contact?: { email?: string | null; first_name?: string | null; company?: string | null } | null;
    }> | null;
  };
}

export async function getCampaignForEditing(campaignId: string, workspaceId: string) {
  requireSupabaseConfiguration();
  const data = await selectCampaignForEditing(campaignId, workspaceId);

  return data as {
    id: string;
    workspace_id: string;
    name: string;
    status: string;
    gmail_account_id: string;
    daily_send_limit: number;
    timezone: string;
    send_window_start: string;
    send_window_end: string;
    campaign_steps?: StoredCampaignStep[] | null;
    campaign_contacts?: Array<{
      contact_id: string;
      status: string;
      current_step: number;
    }> | null;
  };
}

type DueCampaignContact = {
  id: string;
  campaign_id: string;
  contact_id: string;
  current_step: number;
  status: string;
  failed_attempts: number;
  next_due_at: string | null;
  last_thread_id?: string | null;
  contact?: CampaignContactContext | null;
  campaign?: {
    id: string;
    workspace_id: string;
    name: string;
    status: string;
    gmail_account_id: string;
    daily_send_limit: number;
    send_window_start: string;
    send_window_end: string;
    timezone: string;
    campaign_steps?: StoredCampaignStep[] | null;
  } | null;
  outbound_messages?: Array<{ step_number: number }> | null;
};

async function processCampaignContact(item: DueCampaignContact, options?: { ignoreSendWindow?: boolean }) {
  const supabase = createAdminSupabaseClient();
  const campaign = item.campaign;
  const contact = item.contact;

  if (!campaign || !contact || campaign.status !== "active" || contact.unsubscribed_at) {
    return { processed: false, reason: "skipped" as const };
  }

  if (
    !options?.ignoreSendWindow &&
    !isWithinSendWindow(new Date(), campaign.timezone, campaign.send_window_start, campaign.send_window_end)
  ) {
    return { processed: false, reason: "outside_window" as const };
  }

  const step = (campaign.campaign_steps ?? []).find((candidate) => candidate.step_number === item.current_step);

  if (!step || !contact.email) {
    return { processed: false, reason: "missing_step" as const };
  }

  const existingMessage = (item.outbound_messages ?? []).find(
    (message) => message.step_number === item.current_step,
  );

  if (existingMessage) {
    return { processed: false, reason: "already_sent" as const };
  }

  try {
    const mailbox = await getMailboxAccessTokenForAccount(campaign.gmail_account_id);
    const unsubscribeToken = randomUUID();
    const rendered = renderCampaignStepContent(step, contact, buildUnsubscribeLink(unsubscribeToken));
    const sendResult = await sendWithMailboxProvider({
      accessToken: mailbox.accessToken,
      fromEmail: mailbox.emailAddress,
      toEmail: contact.email,
      subject: rendered.subject,
      bodyHtml: rendered.bodyHtml,
      bodyText: rendered.bodyText,
      replyThreadId: item.current_step === 2 ? item.last_thread_id : null,
    });

    const sentAt = new Date().toISOString();

    await supabase.from("outbound_messages").insert({
      campaign_contact_id: item.id,
      gmail_message_id: sendResult.messageId ?? null,
      gmail_thread_id: sendResult.threadId ?? null,
      step_number: item.current_step,
      sent_at: sentAt,
      status: "sent",
    });

    await supabase.from("message_threads").upsert({
      workspace_id: campaign.workspace_id,
      campaign_contact_id: item.id,
      gmail_thread_id: sendResult.threadId || sendResult.messageId || randomUUID(),
      subject: rendered.subject,
      snippet: rendered.snippet,
      latest_message_at: sentAt,
    });

    await supabase.from("unsubscribes").upsert({
      workspace_id: campaign.workspace_id,
      contact_id: item.contact_id,
      email: contact.email,
      token_hash: hashToken(unsubscribeToken),
    });

    await supabase
      .from("campaign_contacts")
      .update({
        status: item.current_step === 1 ? "followup_due" : "followup_sent",
        current_step: item.current_step === 1 ? 2 : item.current_step,
        next_due_at: item.current_step === 1 ? scheduleFollowup(sentAt) : null,
        last_thread_id: sendResult.threadId ?? null,
        last_message_id: sendResult.messageId ?? null,
        error_message: null,
      })
      .eq("id", item.id);

    return { processed: true, reason: "sent" as const };
  } catch (error) {
    await supabase
      .from("campaign_contacts")
      .update({
        status: "failed",
        failed_attempts: item.failed_attempts + 1,
        error_message: error instanceof Error ? error.message : "Unknown send error",
      })
      .eq("id", item.id);

    return { processed: false, reason: "failed" as const };
  }
}

export async function createCampaign(input: {
  workspaceId: string;
  userId: string;
  campaignName: string;
  gmailAccountId: string;
  targetContactIds: string[];
  timezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  dailySendLimit: number;
  primaryStep: CampaignStepInput;
  followupStep: CampaignStepInput;
}) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data: rawCampaign, error } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: input.workspaceId,
      owner_user_id: input.userId,
      name: input.campaignName,
      status: "active",
      gmail_account_id: input.gmailAccountId,
      daily_send_limit: input.dailySendLimit,
      send_window_start: input.sendWindowStart,
      send_window_end: input.sendWindowEnd,
      timezone: input.timezone,
      allowed_send_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  const campaign = rawCampaign as { id: string };

  await upsertCampaignSteps({
    campaignId: campaign.id,
    primaryStep: input.primaryStep,
    followupStep: input.followupStep,
  });

  await supabase.from("campaign_contacts").insert(
    input.targetContactIds.map((contactId) => ({
      campaign_id: campaign.id,
      contact_id: contactId,
      status: "queued",
      current_step: 1,
      next_due_at: new Date().toISOString(),
      failed_attempts: 0,
    })),
  );

  return { id: campaign.id, launched: true };
}

export async function updateCampaign(input: {
  workspaceId: string;
  campaignId: string;
  campaignName: string;
  gmailAccountId: string;
  targetContactIds: string[];
  timezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  dailySendLimit: number;
  primaryStep: CampaignStepInput;
  followupStep: CampaignStepInput;
}) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", input.campaignId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (campaignError) {
    throw campaignError;
  }

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const { error: updateError } = await supabase
    .from("campaigns")
    .update({
      name: input.campaignName,
      gmail_account_id: input.gmailAccountId,
      daily_send_limit: input.dailySendLimit,
      send_window_start: input.sendWindowStart,
      send_window_end: input.sendWindowEnd,
      timezone: input.timezone,
    })
    .eq("id", input.campaignId)
    .eq("workspace_id", input.workspaceId);

  if (updateError) {
    throw updateError;
  }

  await upsertCampaignSteps({
    campaignId: input.campaignId,
    primaryStep: input.primaryStep,
    followupStep: input.followupStep,
  });

  const { data: existingContacts, error: contactsError } = await supabase
    .from("campaign_contacts")
    .select("id, contact_id, status, current_step, outbound_messages(id)")
    .eq("campaign_id", input.campaignId);

  if (contactsError) {
    throw contactsError;
  }

  const selectedIds = new Set(input.targetContactIds);
  const currentContacts = (existingContacts ??
    []) as Array<{
    id: string;
    contact_id: string;
    status: string;
    current_step: number;
    outbound_messages?: Array<{ id: string }> | null;
  }>;
  const existingIds = new Set(currentContacts.map((contact) => contact.contact_id));

  for (const contact of currentContacts) {
    if (selectedIds.has(contact.contact_id)) {
      if (contact.status === "skipped" && !(contact.outbound_messages?.length ?? 0)) {
        await supabase
          .from("campaign_contacts")
          .update({
            status: "queued",
            current_step: 1,
            next_due_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", contact.id);
      }

      continue;
    }

    if ((contact.outbound_messages?.length ?? 0) === 0) {
      await supabase.from("campaign_contacts").delete().eq("id", contact.id);
      continue;
    }

    if (!["replied", "followup_sent", "unsubscribed"].includes(contact.status)) {
      await supabase
        .from("campaign_contacts")
        .update({
          status: "skipped",
          next_due_at: null,
          error_message: "Removed during campaign edit",
        })
        .eq("id", contact.id);
    }
  }

  const contactsToInsert = input.targetContactIds.filter((contactId) => !existingIds.has(contactId));

  if (contactsToInsert.length) {
    const { error: insertError } = await supabase.from("campaign_contacts").insert(
      contactsToInsert.map((contactId) => ({
        campaign_id: input.campaignId,
        contact_id: contactId,
        status: "queued",
        current_step: 1,
        next_due_at: new Date().toISOString(),
        failed_attempts: 0,
      })),
    );

    if (insertError) {
      throw insertError;
    }
  }

  return { id: input.campaignId, updated: true };
}

export async function deleteCampaign(campaignId: string, workspaceId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw error;
  }

  return { campaignId, deleted: true };
}

export async function pauseCampaign(campaignId: string, status: "paused" | "active") {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  await supabase.from("campaigns").update({ status }).eq("id", campaignId);
  return { campaignId, status };
}

export async function markFailedContactForResend(campaignContactId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("campaign_contacts")
    .update({
      status: "queued",
      next_due_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", campaignContactId);

  return { campaignContactId, status: "queued" };
}

export async function sendCampaignNow(campaignId: string, workspaceId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (campaignError) {
    throw campaignError;
  }

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const { data, error } = await supabase
    .from("campaign_contacts")
    .select(
      `
      id,
      campaign_id,
      contact_id,
      current_step,
      status,
      failed_attempts,
      next_due_at,
      last_thread_id,
      contact:contacts(email, first_name, last_name, company, website, job_title, custom_fields_jsonb, unsubscribed_at),
      campaign:campaigns(
        id,
        workspace_id,
        name,
        status,
        gmail_account_id,
        daily_send_limit,
        send_window_start,
        send_window_end,
        timezone,
        campaign_steps(step_number, step_type, subject_template, body_template, body_html_template, wait_days)
      ),
      outbound_messages(step_number)
    `,
    )
    .eq("campaign_id", campaignId)
    .in("status", ["queued", "followup_due"])
    .lte("next_due_at", new Date().toISOString())
    .order("next_due_at", { ascending: true });

  if (error) {
    if (isCampaignSchemaCacheError(error)) {
      const fallback = await supabase
        .from("campaign_contacts")
        .select(
          `
          id,
          campaign_id,
          contact_id,
          current_step,
          status,
          failed_attempts,
          next_due_at,
          last_thread_id,
          contact:contacts(email, first_name, last_name, company, website, job_title, custom_fields_jsonb, unsubscribed_at),
          campaign:campaigns(
            id,
            workspace_id,
            name,
            status,
            gmail_account_id,
            daily_send_limit,
            send_window_start,
            send_window_end,
            timezone,
            campaign_steps(step_number, step_type, subject_template, body_template, wait_days)
          ),
          outbound_messages(step_number)
        `,
        )
        .eq("campaign_id", campaignId)
        .in("status", ["queued", "followup_due"])
        .lte("next_due_at", new Date().toISOString())
        .order("next_due_at", { ascending: true });

      if (fallback.error) {
        throw fallback.error;
      }

      let processed = 0;

      for (const item of (fallback.data ?? []) as DueCampaignContact[]) {
        const result = await processCampaignContact(item, { ignoreSendWindow: true });
        if (result.processed) {
          processed += 1;
        }
      }

      return { campaignId, processed };
    }
    throw error;
  }

  let processed = 0;

  for (const item of (data ?? []) as DueCampaignContact[]) {
    const result = await processCampaignContact(item, { ignoreSendWindow: true });
    if (result.processed) {
      processed += 1;
    }
  }

  return { campaignId, processed };
}

export function scheduleFollowup(sentAt: string) {
  return addDays(new Date(sentAt), env.FOLLOW_UP_DELAY_DAYS).toISOString();
}

export function canSendNow(timezone: string, sendWindowStart: string, sendWindowEnd: string) {
  return isWithinSendWindow(new Date(), timezone, sendWindowStart, sendWindowEnd);
}
