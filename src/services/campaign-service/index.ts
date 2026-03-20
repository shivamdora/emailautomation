import "server-only";
import { addDays } from "date-fns";
import { createHash, randomUUID } from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env, requireSupabaseConfiguration } from "@/lib/supabase/env";
import { escapeHtml, normalizeEmailHtmlDocument, stripHtmlToText } from "@/lib/utils/html";
import { isAnyMissingColumnResult } from "@/lib/utils/supabase-schema";
import { renderTemplate } from "@/lib/utils/template";
import {
  buildWorkflowDefinitionFromStoredSteps,
  deriveCampaignStepsFromWorkflow,
  getNextWorkflowStep,
  getWorkflowStepByNumber,
  normalizeWorkflowDefinition,
  resolveWorkflowAdvance,
  type CampaignWorkflowDefinition,
  type StoredWorkflowEvent,
  type WorkflowStepInput,
} from "@/lib/workflows/definition";
import { isWithinSendWindow } from "@/lib/utils/time";
import { assertWorkspaceCanCreateCampaign, refreshWorkspaceUsageCounters } from "@/services/entitlement-service";
import { getMailboxAccessTokenForAccount, sendWithMailboxProvider } from "@/services/gmail-service";
import { instrumentHtmlForTracking, recordMessageEvent } from "@/services/telemetry-service";
import { getSeedTemplateDefinitions } from "@/services/template-seed-service";

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

type ListedTemplateRecord = {
  id: string;
  name: string;
  subject_template: string;
  body_template: string;
  body_html_template?: string | null;
  preview_text?: string | null;
  category?: string | null;
  tags?: string[] | null;
  design_preset?: string | null;
  is_system_template?: boolean | null;
  created_at: string;
};

function resolveCampaignWorkflowDefinition(input: {
  workflowDefinition?: Partial<CampaignWorkflowDefinition> | null;
  campaignSteps?: StoredCampaignStep[] | null;
}) {
  const normalized = normalizeWorkflowDefinition(input.workflowDefinition);

  if (normalized.steps.length) {
    return normalized;
  }

  return buildWorkflowDefinitionFromStoredSteps(input.campaignSteps ?? []);
}

function getSeedTemplateLookup() {
  return new Map(
    getSeedTemplateDefinitions().map((template) => [
      `${template.name}::${template.subjectTemplate}`,
      template,
    ]),
  );
}

function isLegacyIntroTemplate(template: ListedTemplateRecord) {
  return (
    template.name === "Intro Outreach" &&
    template.subject_template === "Quick idea for {{company}}" &&
    template.body_template.includes("Short, warm outreach designed to feel personal instead of automated.") &&
    template.body_template.includes("We usually help teams tighten three things first:")
  );
}

function hydrateListedTemplates(templates: ListedTemplateRecord[]) {
  const seedLookup = getSeedTemplateLookup();
  const hydrated = templates.map((template) => {
    const seedTemplate = seedLookup.get(
      `${template.name}::${template.subject_template}`,
    );

    return {
      ...template,
      body_html_template: template.body_html_template ?? seedTemplate?.bodyHtmlTemplate ?? null,
      preview_text: template.preview_text ?? seedTemplate?.previewText ?? template.body_template.slice(0, 180),
      category: template.category ?? seedTemplate?.category ?? null,
      tags: template.tags ?? seedTemplate?.tags ?? [],
      design_preset: template.design_preset ?? seedTemplate?.designPreset ?? null,
      is_system_template: Boolean(template.is_system_template ?? seedTemplate),
    };
  });

  const hasShelterScoreTemplate = hydrated.some(
    (template) => template.name === "Shelter Score Launch Template",
  );

  if (!hasShelterScoreTemplate) {
    return hydrated;
  }

  return hydrated.filter((template) => !isLegacyIntroTemplate(template));
}

function isCampaignSchemaCacheError(error: { message?: string | null; details?: string | null; hint?: string | null } | null | undefined) {
  const parts = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  const knownLaunchColumns = [
    "body_html_template",
    "preview_text",
    "workflow_definition_jsonb",
    "reply_disposition",
    "meeting_booked_at",
    "exit_reason",
    "current_node_key",
    "branch_history_jsonb",
  ];

  return (
    parts.includes("schema cache") ||
    parts.includes("could not find the column") ||
    knownLaunchColumns.some((column) => parts.includes(column)) ||
    /column\s+[a-z0-9_]+(?:_[0-9]+)?\.[a-z0-9_]+\s+does not exist/.test(parts)
  );
}

function isCampaignSchemaResult(
  result: {
    error?: { message?: string | null; details?: string | null; hint?: string | null } | null;
    status?: number | null;
    data?: unknown;
  } | null | undefined,
) {
  return (
    isCampaignSchemaCacheError(result?.error) ||
    isAnyMissingColumnResult(result, [
      { table: "campaigns", column: "workflow_definition_jsonb" },
      { table: "campaign_steps", column: "body_html_template" },
      { table: "templates", column: "body_html_template" },
      { table: "templates", column: "preview_text" },
      { table: "campaign_contacts", column: "current_node_key" },
      { table: "campaign_contacts", column: "branch_history_jsonb" },
      { table: "campaign_contacts", column: "reply_disposition" },
      { table: "campaign_contacts", column: "meeting_booked_at" },
      { table: "campaign_contacts", column: "exit_reason" },
    ])
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

function stripUnsupportedCampaignContactFields(values: Record<string, unknown>) {
  const fallbackValues = { ...values };
  delete fallbackValues.current_node_key;
  delete fallbackValues.branch_history_jsonb;
  delete fallbackValues.exit_reason;
  delete fallbackValues.reply_disposition;
  delete fallbackValues.meeting_booked_at;

  return fallbackValues;
}

async function updateCampaignContactRecord(campaignContactId: string, values: Record<string, unknown>) {
  const supabase = createAdminSupabaseClient();
  let result = await supabase
    .from("campaign_contacts")
    .update(values)
    .eq("id", campaignContactId);

  if (result.error && isCampaignSchemaCacheError(result.error)) {
    result = await supabase
      .from("campaign_contacts")
      .update(stripUnsupportedCampaignContactFields(values))
      .eq("id", campaignContactId);
  }

  if (result.error) {
    throw result.error;
  }
}

async function insertCampaignContacts(rows: Array<Record<string, unknown>>) {
  const supabase = createAdminSupabaseClient();
  let result = await supabase.from("campaign_contacts").insert(rows);

  if (result.error && isCampaignSchemaCacheError(result.error)) {
    result = await supabase
      .from("campaign_contacts")
      .insert(rows.map((row) => stripUnsupportedCampaignContactFields(row)));
  }

  if (result.error) {
    throw result.error;
  }
}

async function upsertCampaignSteps(input: {
  campaignId: string;
  workflowDefinition: CampaignWorkflowDefinition;
}) {
  const supabase = createAdminSupabaseClient();
  const normalizedWorkflow = normalizeWorkflowDefinition(input.workflowDefinition);
  const stepRows = deriveCampaignStepsFromWorkflow(normalizedWorkflow).map((step) => ({
    campaign_id: input.campaignId,
    ...step,
  }));

  const { error: deleteError } = await supabase
    .from("campaign_steps")
    .delete()
    .eq("campaign_id", input.campaignId);

  if (deleteError) {
    throw deleteError;
  }

  const { error } = await supabase.from("campaign_steps").insert(stepRows);

  if (error) {
    if (isCampaignSchemaCacheError(error)) {
      if (stepRows.some((step) => step.body_html_template)) {
        throw new Error(
          "HTML campaigns are not enabled in this database yet. Apply the latest Supabase migration to add campaign_steps.body_html_template before sending designed HTML emails.",
        );
      }

      const fallback = await supabase.from("campaign_steps").insert(
        stepRows.map((step) => {
          return {
            campaign_id: step.campaign_id,
            step_number: step.step_number,
            step_type: step.step_type,
            subject_template: step.subject_template,
            body_template: step.body_template,
            wait_days: step.wait_days,
          };
        }),
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
      "id, name, status, daily_send_limit, timezone, send_window_start, send_window_end, gmail_account_id, workflow_definition_jsonb, campaign_steps(id, step_number, step_type, subject_template, body_template, body_html_template, wait_days), campaign_contacts(id, status, current_step, next_due_at, contact_id, contact:contacts(email, first_name, company))",
    )
    .eq("id", campaignId)
    .single();

  if (isCampaignSchemaResult(result)) {
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
      "id, workspace_id, name, status, gmail_account_id, daily_send_limit, timezone, send_window_start, send_window_end, workflow_definition_jsonb, campaign_steps(step_number, step_type, subject_template, body_template, body_html_template, wait_days), campaign_contacts(contact_id, status, current_step)",
    )
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .single();

  if (isCampaignSchemaResult(result)) {
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
    .select("id, name, subject_template, body_template, body_html_template, preview_text, category, tags, design_preset, is_system_template, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (isCampaignSchemaResult(result)) {
    result = await supabase
      .from("templates")
      .select("id, name, subject_template, body_template, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
  }

  if (result.error) {
    throw result.error;
  }

  return hydrateListedTemplates((result.data ?? []) as ListedTemplateRecord[]);
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
  await assertWorkspaceCanCreateCampaign(input.workspaceId);

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
    preview_text: (normalized.body_template || stripHtmlToText(normalized.body_html_template ?? "")).slice(0, 180),
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
    workflow_definition_jsonb?: Partial<CampaignWorkflowDefinition> | null;
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
    workflow_definition_jsonb?: Partial<CampaignWorkflowDefinition> | null;
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
  current_node_key?: string | null;
  branch_history_jsonb?: Array<Record<string, unknown>> | null;
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
    workflow_definition_jsonb?: Partial<CampaignWorkflowDefinition> | null;
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

  const workflowDefinition = resolveCampaignWorkflowDefinition({
    workflowDefinition: campaign.workflow_definition_jsonb,
    campaignSteps: campaign.campaign_steps,
  });
  const workflowStep = getWorkflowStepByNumber(workflowDefinition, item.current_step);
  const step = workflowStep
    ? {
        step_number: workflowStep.stepNumber,
        subject_template: workflowStep.subject,
        body_template: workflowStep.body,
        body_html_template: workflowStep.mode === "html" ? workflowStep.bodyHtml || null : null,
        wait_days: workflowStep.waitDays,
      }
    : null;

  if (!step || !contact.email) {
    return { processed: false, reason: "missing_step" as const };
  }

  const existingMessage = (item.outbound_messages ?? []).find(
    (message) => message.step_number === item.current_step,
  );

  if (existingMessage) {
    const { data: rawEvents, error: eventsError } = await supabase
      .from("message_events")
      .select("event_type, metadata")
      .eq("campaign_contact_id", item.id)
      .order("occurred_at", { ascending: true });

    if (eventsError) {
      throw eventsError;
    }

    const events = ((rawEvents ?? []) as Array<{
      event_type: string;
      metadata?: { stepNumber?: number | string | null } | null;
    }>).map((event) => ({
      eventType: event.event_type,
      stepNumber: event.metadata?.stepNumber ? Number(event.metadata.stepNumber) : null,
    })) as StoredWorkflowEvent[];
    const resolution = resolveWorkflowAdvance({
      definition: workflowDefinition,
      stepNumber: item.current_step,
      events,
    });

    if (resolution.action === "advance") {
      const nextDueAt = new Date().toISOString();
      const branchHistory = [...(item.branch_history_jsonb ?? []), {
        fromStep: item.current_step,
        toStep: resolution.nextStep.stepNumber,
        matched: resolution.matched,
        branchCondition: workflowStep?.branchCondition ?? "time",
        reason: resolution.transitionReason,
        resolvedAt: nextDueAt,
      }];
      await updateCampaignContactRecord(item.id, {
        status: resolution.nextStep.stepNumber > 1 ? "followup_due" : "queued",
        current_step: resolution.nextStep.stepNumber,
        current_node_key: resolution.nextStep.key,
        branch_history_jsonb: branchHistory,
        next_due_at: nextDueAt,
        error_message: null,
      });

      return { processed: false, reason: "advanced" as const };
    }

    await updateCampaignContactRecord(item.id, {
      status: item.current_step > 1 ? "followup_sent" : "sent",
      current_node_key: null,
      next_due_at: null,
      exit_reason: resolution.exitReason,
      error_message: null,
    });

    return { processed: false, reason: "workflow_exit" as const };
  }

  try {
    const mailbox = await getMailboxAccessTokenForAccount(campaign.gmail_account_id);
    const unsubscribeToken = randomUUID();
    const rendered = renderCampaignStepContent(step, contact, buildUnsubscribeLink(unsubscribeToken));
    const trackedHtml = await instrumentHtmlForTracking({
      workspaceId: campaign.workspace_id,
      campaignContactId: item.id,
      stepNumber: item.current_step,
      html: rendered.bodyHtml,
    });
    const sendResult = await sendWithMailboxProvider({
      accessToken: mailbox.accessToken,
      fromEmail: mailbox.emailAddress,
      toEmail: contact.email,
      subject: rendered.subject,
      bodyHtml: trackedHtml,
      bodyText: rendered.bodyText,
      replyThreadId: item.current_step > 1 ? item.last_thread_id : null,
    });

    const sentAt = new Date().toISOString();
    const nextWorkflowStep = getNextWorkflowStep(workflowDefinition, item.current_step);

    const { data: outboundMessage, error: outboundMessageError } = await supabase.from("outbound_messages").insert({
      campaign_contact_id: item.id,
      gmail_message_id: sendResult.messageId ?? null,
      gmail_thread_id: sendResult.threadId ?? null,
      step_number: item.current_step,
      sent_at: sentAt,
      status: "sent",
    }).select("id").single();

    if (outboundMessageError) {
      throw outboundMessageError;
    }

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

    await updateCampaignContactRecord(item.id, {
      status: nextWorkflowStep ? "sent" : item.current_step > 1 ? "followup_sent" : "sent",
      current_step: item.current_step,
      current_node_key: workflowStep?.key ?? `step-${item.current_step}`,
      next_due_at: nextWorkflowStep ? addDays(new Date(sentAt), Math.max(step.wait_days ?? 0, 0)).toISOString() : null,
      last_thread_id: sendResult.threadId ?? null,
      last_message_id: sendResult.messageId ?? null,
      error_message: null,
    });

    await recordMessageEvent({
      workspaceId: campaign.workspace_id,
      campaignContactId: item.id,
      outboundMessageId: (outboundMessage as { id?: string } | null)?.id ?? null,
      gmailMessageId: sendResult.messageId ?? null,
      eventType: "sent",
      metadata: {
        stepNumber: item.current_step,
        subject: rendered.subject,
        toEmail: contact.email,
      },
    });

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
  workflowDefinition: { version?: number; steps?: WorkflowStepInput[] };
}) {
  requireSupabaseConfiguration();
  await assertWorkspaceCanCreateCampaign(input.workspaceId);
  const workflowDefinition = normalizeWorkflowDefinition(input.workflowDefinition);

  const supabase = createAdminSupabaseClient();
  let createResult = await supabase
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
      workflow_definition_jsonb: workflowDefinition,
      allowed_send_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    })
    .select("id")
    .single();

  if (isCampaignSchemaResult(createResult)) {
    createResult = await supabase
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
  }

  const { data: rawCampaign, error } = createResult;

  if (error) {
    throw error;
  }

  const campaign = rawCampaign as { id: string };

  await upsertCampaignSteps({
    campaignId: campaign.id,
    workflowDefinition,
  });

  await insertCampaignContacts(
    input.targetContactIds.map((contactId) => ({
      campaign_id: campaign.id,
      contact_id: contactId,
      status: "queued",
      current_step: 1,
      current_node_key: workflowDefinition.steps[0]?.key ?? "step-1",
      next_due_at: new Date().toISOString(),
      failed_attempts: 0,
    })),
  );

  await refreshWorkspaceUsageCounters(input.workspaceId);

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
  workflowDefinition: { version?: number; steps?: WorkflowStepInput[] };
}) {
  requireSupabaseConfiguration();
  const workflowDefinition = normalizeWorkflowDefinition(input.workflowDefinition);

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
      workflow_definition_jsonb: workflowDefinition,
    })
    .eq("id", input.campaignId)
    .eq("workspace_id", input.workspaceId);

  if (updateError && !isCampaignSchemaCacheError(updateError)) {
    throw updateError;
  }

  if (updateError && isCampaignSchemaCacheError(updateError)) {
    const { error: fallbackUpdateError } = await supabase
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

    if (fallbackUpdateError) {
      throw fallbackUpdateError;
    }
  }

  await upsertCampaignSteps({
    campaignId: input.campaignId,
    workflowDefinition,
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
        await updateCampaignContactRecord(contact.id, {
          status: "queued",
          current_step: 1,
          current_node_key: workflowDefinition.steps[0]?.key ?? "step-1",
          next_due_at: new Date().toISOString(),
          error_message: null,
        });
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
    await insertCampaignContacts(
      contactsToInsert.map((contactId) => ({
        campaign_id: input.campaignId,
        contact_id: contactId,
        status: "queued",
        current_step: 1,
        current_node_key: workflowDefinition.steps[0]?.key ?? "step-1",
        next_due_at: new Date().toISOString(),
        failed_attempts: 0,
      })),
    );
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

  await refreshWorkspaceUsageCounters(workspaceId);

  return { campaignId, deleted: true };
}

export async function pauseCampaign(campaignId: string, status: "paused" | "active") {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  await supabase.from("campaigns").update({ status }).eq("id", campaignId);

  const { data: rawCampaign } = await supabase
    .from("campaigns")
    .select("workspace_id")
    .eq("id", campaignId)
    .maybeSingle();
  const campaign = rawCampaign as { workspace_id?: string | null } | null;

  if (campaign?.workspace_id) {
    await refreshWorkspaceUsageCounters(campaign.workspace_id);
  }

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

  let dueContactsResult = await supabase
    .from("campaign_contacts")
    .select(
      `
      id,
      campaign_id,
      contact_id,
      current_step,
      current_node_key,
      branch_history_jsonb,
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
        workflow_definition_jsonb,
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
    .in("status", ["queued", "followup_due", "sent"])
    .lte("next_due_at", new Date().toISOString())
    .order("next_due_at", { ascending: true });

  if (isCampaignSchemaResult(dueContactsResult)) {
    dueContactsResult = await supabase
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
      .in("status", ["queued", "followup_due", "sent"])
      .lte("next_due_at", new Date().toISOString())
      .order("next_due_at", { ascending: true });
  }

  const { data, error } = dueContactsResult;

  if (error) {
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
