import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "https://esm.sh/jose@6.2.1";
import {
  computeNextScheduledSendAt,
  computeNextWindowStartAt,
  computeRetryScheduledAt,
  getDateKeyInTimeZone,
  getDayBoundsInTimeZone,
  isTerminalCampaignContactStatus,
  isWithinAllowedSendDay,
} from "../../../src/lib/campaigns/send-queue-shared.ts";
import { config } from "../shared/config.ts";
import { decryptToken, encryptToken } from "../shared/crypto.ts";
import { enqueueCrmWritebackJobs } from "../shared/crm.ts";
import { gmailRefreshAccessToken, gmailSend } from "../shared/gmail.ts";
import { json } from "../shared/response.ts";

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
const MAX_JOB_ATTEMPTS = 5;

type WorkflowStep = {
  key: string;
  stepNumber: number;
  name: string;
  waitDays: number;
  branchCondition: string;
  onMatch: string;
  onNoMatch: string;
  subject: string;
  mode: string;
  body: string;
  bodyHtml: string;
};

type ReservedJobRecord = {
  id: string;
  campaign_id: string;
  campaign_contact_id: string;
  step_number: number;
  status: string;
  scheduled_for: string;
  attempt_count: number;
  reservation_token?: string | null;
  campaign_contact?: {
    id: string;
    contact_id: string;
    status: string;
    current_step: number;
    failed_attempts: number;
    last_thread_id?: string | null;
    last_message_id?: string | null;
    contact?: {
      email?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      company?: string | null;
      website?: string | null;
      job_title?: string | null;
      custom_fields_jsonb?: Record<string, unknown> | null;
      unsubscribed_at?: string | null;
    } | null;
    outbound_messages?: Array<{
      id: string;
      step_number: number;
      status?: string | null;
      sent_at?: string | null;
      gmail_message_id?: string | null;
      gmail_thread_id?: string | null;
    }> | null;
  } | null;
  campaign?: {
    id: string;
    workspace_id: string;
    project_id: string;
    name: string;
    status: string;
    gmail_account_id: string;
    workflow_definition_jsonb?: { steps?: Array<Record<string, unknown>> } | null;
    daily_send_limit: number;
    send_window_start: string;
    send_window_end: string;
    timezone: string;
    allowed_send_days?: string[] | null;
    campaign_steps?: Array<Record<string, unknown>> | null;
  } | null;
};

function verifyCron(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  return config.cronVerifySecret ? secret === config.cronVerifySecret : true;
}

function renderTemplate(template: string, payload: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => {
    if (key.startsWith("custom.")) {
      const custom = (payload.custom_fields_jsonb as Record<string, unknown> | undefined) ?? {};
      return String(custom[key.replace("custom.", "")] ?? "");
    }

    return String(payload[key] ?? "");
  });
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function getTrackingSecret() {
  const token = Deno.env.get("TOKEN_ENCRYPTION_KEY");

  if (!token) {
    throw new Error("Missing TOKEN_ENCRYPTION_KEY");
  }

  return new TextEncoder().encode(token);
}

async function signTrackingPayload(payload: {
  workspaceId: string;
  campaignContactId: string;
  stepNumber: number;
  eventType: "opened" | "clicked";
  targetUrl?: string | null;
}) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(getTrackingSecret());
}

async function instrumentHtmlForTracking(input: {
  workspaceId: string;
  campaignContactId: string;
  stepNumber: number;
  html: string;
}) {
  const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
  const openToken = await signTrackingPayload({
    workspaceId: input.workspaceId,
    campaignContactId: input.campaignContactId,
    stepNumber: input.stepNumber,
    eventType: "opened",
  });
  const openPixel = `<img src="${appUrl}/api/track/open?token=${encodeURIComponent(openToken)}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;opacity:0;" />`;
  const matches = Array.from(input.html.matchAll(/href=(["'])(.*?)\1/gi));
  let trackedHtml = input.html;

  for (const [match, quote, href] of matches) {
    if (!/^https?:\/\//i.test(href.trim())) {
      continue;
    }

    const clickToken = await signTrackingPayload({
      workspaceId: input.workspaceId,
      campaignContactId: input.campaignContactId,
      stepNumber: input.stepNumber,
      eventType: "clicked",
      targetUrl: href,
    });
    trackedHtml = trackedHtml.replace(
      match,
      `href=${quote}${Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000"}/api/track/click?token=${encodeURIComponent(clickToken)}${quote}`,
    );
  }

  return `${trackedHtml}${openPixel}`;
}

function isWithinSendWindow(date: Date, timezone: string, start: string, end: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((accumulator, part) => {
      if (part.type !== "literal") {
        accumulator[part.type] = part.value;
      }

      return accumulator;
    }, {});
  const currentMinutes = Number(parts.hour ?? "0") * 60 + Number(parts.minute ?? "0");
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return currentMinutes >= startHour * 60 + startMinute && currentMinutes <= endHour * 60 + endMinute;
}

function normalizeWorkflowDefinition(definition: unknown, storedSteps: Array<Record<string, unknown>>) {
  const workflowSteps = Array.isArray((definition as { steps?: unknown[] } | null)?.steps)
    ? ((definition as { steps: Array<Record<string, unknown>> }).steps ?? [])
    : storedSteps
        .slice()
        .sort((left, right) => Number(left.step_number ?? 0) - Number(right.step_number ?? 0))
        .map((step, index, allSteps) => ({
          name: index === 0 ? "Primary email" : `Step ${index + 1}`,
          waitDays: Number(step.wait_days ?? 0),
          branchCondition: "time",
          onMatch: index === allSteps.length - 1 ? "exit_sequence" : "next_step",
          onNoMatch: index === allSteps.length - 1 ? "exit_sequence" : "next_step",
          subject: String(step.subject_template ?? ""),
          mode: step.body_html_template ? "html" : "text",
          body: String(step.body_template ?? ""),
          bodyHtml: String(step.body_html_template ?? ""),
        }));

  return workflowSteps.map((step, index) => ({
    key: `step-${index + 1}`,
    stepNumber: index + 1,
    name: String(step.name ?? `Step ${index + 1}`),
    waitDays: Number(step.waitDays ?? 0),
    branchCondition: String(step.branchCondition ?? "time"),
    onMatch: String(step.onMatch ?? "next_step"),
    onNoMatch: String(step.onNoMatch ?? "next_step"),
    subject: String(step.subject ?? ""),
    mode: String(step.mode ?? "text"),
    body: String(step.body ?? ""),
    bodyHtml: String(step.bodyHtml ?? ""),
  })) as WorkflowStep[];
}

function resolveWorkflowAdvance(
  workflowSteps: WorkflowStep[],
  stepNumber: number,
  events: Array<{ event_type: string; metadata?: { stepNumber?: number | string | null } | null }>,
) {
  const currentStep = workflowSteps.find((step) => Number(step.stepNumber) === stepNumber);
  const nextStep = workflowSteps.find((step) => Number(step.stepNumber) === stepNumber + 1);

  if (!currentStep) {
    return { action: "exit", exitReason: "missing_step" };
  }

  if (!nextStep) {
    return { action: "exit", exitReason: "workflow_complete" };
  }

  const condition = String(currentStep.branchCondition ?? "time");

  if (condition === "time") {
    return String(currentStep.onMatch ?? "next_step") === "next_step"
      ? { action: "advance", nextStep, matched: true, reason: "time_elapsed" }
      : { action: "exit", exitReason: "time_elapsed_exit" };
  }

  const matched = events.some(
    (event) =>
      event.event_type === (condition === "opened" ? "opened" : "clicked") &&
      Number(event.metadata?.stepNumber ?? 0) === stepNumber,
  );
  const outcome = matched
    ? String(currentStep.onMatch ?? "next_step")
    : String(currentStep.onNoMatch ?? "next_step");

  return outcome === "next_step"
    ? {
        action: "advance",
        nextStep,
        matched,
        reason: matched ? `${condition}_matched` : `${condition}_missing`,
      }
    : {
        action: "exit",
        exitReason: matched ? `${condition}_matched_exit` : `${condition}_missing_exit`,
      };
}

async function resolveMailboxAccess(mailbox: {
  oauth_connection?: {
    id?: string;
    access_token_encrypted?: string | null;
    refresh_token_encrypted?: string | null;
    token_expiry?: string | null;
  } | null;
}) {
  const oauthConnection = mailbox.oauth_connection;

  if (!oauthConnection) {
    throw new Error("Missing oauth connection.");
  }

  const shouldRefresh =
    !oauthConnection.access_token_encrypted ||
    (oauthConnection.token_expiry &&
      new Date(oauthConnection.token_expiry).getTime() <= Date.now() + 60_000);

  if (!shouldRefresh && oauthConnection.access_token_encrypted) {
    return decryptToken(oauthConnection.access_token_encrypted);
  }

  if (!oauthConnection.refresh_token_encrypted) {
    throw new Error("Missing refresh token.");
  }

  const refreshed = await gmailRefreshAccessToken(
    await decryptToken(oauthConnection.refresh_token_encrypted),
  );

  await supabase
    .from("oauth_connections")
    .update({
      access_token_encrypted: await encryptToken(refreshed.access_token),
      token_expiry: refreshed.expires_in
        ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString()
        : null,
    })
    .eq("id", oauthConnection.id);

  return refreshed.access_token as string;
}

async function getWorkspaceSendState(workspaceId: string) {
  const [billingAccount, dailyCount, monthlyCount] = await Promise.all([
    supabase
      .from("workspace_billing_accounts")
      .select("status, plan_key")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("outbound_messages")
      .select("id, campaign_contact:campaign_contacts!inner(campaign:campaigns!inner(workspace_id))", {
        count: "exact",
        head: true,
      })
      .eq("campaign_contact.campaign.workspace_id", workspaceId)
      .eq("status", "sent")
      .gte(
        "sent_at",
        new Date(
          Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate(),
          ),
        ).toISOString(),
      ),
    supabase
      .from("outbound_messages")
      .select("id, campaign_contact:campaign_contacts!inner(campaign:campaigns!inner(workspace_id))", {
        count: "exact",
        head: true,
      })
      .eq("campaign_contact.campaign.workspace_id", workspaceId)
      .eq("status", "sent")
      .gte(
        "sent_at",
        new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString(),
      ),
  ]);
  const planKey = billingAccount.data?.plan_key ?? "internal_mvp";
  const planLimits = await supabase
    .from("plan_limits")
    .select("daily_sends_limit, monthly_sends_limit")
    .eq("plan_key", planKey)
    .maybeSingle();

  return {
    billingStatus: billingAccount.data?.status ?? "active",
    dailyLimit: planLimits.data?.daily_sends_limit ?? 250,
    monthlyLimit: planLimits.data?.monthly_sends_limit ?? 5000,
    dailyUsed: dailyCount.count ?? 0,
    monthlyUsed: monthlyCount.count ?? 0,
  };
}

async function updateQueueRun(
  runId: string | null,
  input: {
    status: "success" | "partial" | "error";
    processedCount: number;
    errorCount: number;
    metadata?: Record<string, unknown>;
  },
) {
  if (!runId) {
    return;
  }

  await supabase
    .from("campaign_queue_runs")
    .update({
      status: input.status,
      finished_at: new Date().toISOString(),
      processed_count: input.processedCount,
      error_count: input.errorCount,
      metadata: input.metadata ?? {},
    })
    .eq("id", runId);
}

async function startQueueRun(metadata: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("campaign_queue_runs")
    .insert({
      worker_name: "send-due-messages",
      status: "success",
      started_at: new Date().toISOString(),
      metadata,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to start queue run", error);
    return null;
  }

  return (data as { id?: string } | null)?.id ?? null;
}

async function syncCampaignContactNextDueAt(campaignContactId: string) {
  const { data, error } = await supabase
    .from("campaign_send_jobs")
    .select("scheduled_for")
    .eq("campaign_contact_id", campaignContactId)
    .in("status", ["pending", "reserved"])
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const scheduledFor = (data as { scheduled_for?: string | null } | null)?.scheduled_for ?? null;
  await supabase
    .from("campaign_contacts")
    .update({ next_due_at: scheduledFor })
    .eq("id", campaignContactId);

  return scheduledFor;
}

async function updateJob(jobId: string, values: Record<string, unknown>) {
  const { error } = await supabase.from("campaign_send_jobs").update(values).eq("id", jobId);

  if (error) {
    throw error;
  }
}

async function cancelCurrentJob(input: {
  jobId: string;
  campaignContactId: string;
  reason: string;
  campaignContactStatus?: string;
  currentStep?: number;
}) {
  const now = new Date().toISOString();
  await updateJob(input.jobId, {
    status: "canceled",
    canceled_at: now,
    processed_at: now,
    last_error: input.reason,
    reservation_token: null,
  });

  if (input.campaignContactStatus) {
    await supabase
      .from("campaign_contacts")
      .update({
        status: input.campaignContactStatus,
        current_step: input.currentStep ?? undefined,
        next_due_at: null,
        error_message: null,
      })
      .eq("id", input.campaignContactId);
  } else {
    await syncCampaignContactNextDueAt(input.campaignContactId);
  }
}

async function releaseReservedJob(input: {
  jobId: string;
  campaignContactId: string;
  scheduledFor: string;
  lastError?: string | null;
}) {
  await updateJob(input.jobId, {
    status: "pending",
    scheduled_for: input.scheduledFor,
    reserved_at: null,
    reservation_token: null,
    last_error: input.lastError ?? null,
  });
  await supabase
    .from("campaign_contacts")
    .update({
      next_due_at: input.scheduledFor,
      error_message: input.lastError ?? null,
    })
    .eq("id", input.campaignContactId);
}

async function queueNextStep(input: {
  campaign: NonNullable<ReservedJobRecord["campaign"]>;
  campaignContact: NonNullable<ReservedJobRecord["campaign_contact"]>;
  nextStep: WorkflowStep;
  scheduledFor: string;
}) {
  const existing = await supabase
    .from("campaign_send_jobs")
    .select("id, status")
    .eq("campaign_contact_id", input.campaignContact.id)
    .eq("step_number", input.nextStep.stepNumber)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if ((existing.data as { status?: string | null } | null)?.status === "sent") {
    await syncCampaignContactNextDueAt(input.campaignContact.id);
    return;
  }

  const payload = {
    workspace_id: input.campaign.workspace_id,
    project_id: input.campaign.project_id,
    campaign_id: input.campaign.id,
    campaign_contact_id: input.campaignContact.id,
    step_number: input.nextStep.stepNumber,
    scheduled_for: input.scheduledFor,
    status: "pending",
    reserved_at: null,
    processed_at: null,
    canceled_at: null,
    reservation_token: null,
    attempt_count: 0,
    last_error: null,
  };

  if (existing.data) {
    await supabase
      .from("campaign_send_jobs")
      .update(payload)
      .eq("id", (existing.data as { id: string }).id);
  } else {
    await supabase.from("campaign_send_jobs").insert(payload);
  }

  await supabase
    .from("campaign_contacts")
    .update({
      status: input.nextStep.stepNumber > 1 ? "followup_due" : "queued",
      current_step: input.nextStep.stepNumber,
      next_due_at: input.scheduledFor,
      error_message: null,
    })
    .eq("id", input.campaignContact.id);
}

async function upsertUnsubscribeRecord(input: {
  workspaceId: string;
  contactId: string;
  email: string;
  token: string;
}) {
  await supabase.from("unsubscribes").upsert({
    workspace_id: input.workspaceId,
    contact_id: input.contactId,
    email: input.email,
    token_hash: await hashToken(input.token),
  });
}

function getRetryDelayMinutes(attemptCount: number) {
  if (attemptCount <= 1) {
    return 5;
  }

  if (attemptCount === 2) {
    return 15;
  }

  if (attemptCount === 3) {
    return 30;
  }

  return 60;
}

function isPermanentSendError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("pending workspace approval") ||
    normalized.includes("missing refresh token") ||
    normalized.includes("missing oauth connection") ||
    normalized.includes("invalid_grant") ||
    normalized.includes("insufficient permissions") ||
    normalized.includes("mailbox connection not found")
  );
}

function buildRenderedContent(input: {
  step: WorkflowStep;
  contact: NonNullable<NonNullable<ReservedJobRecord["campaign_contact"]>["contact"]>;
  unsubscribeLink: string;
}) {
  const renderedSubject = renderTemplate(input.step.subject, input.contact);
  const renderedTextBody = renderTemplate(input.step.body, input.contact);
  const renderedHtmlBody =
    input.step.mode === "html" && input.step.bodyHtml
      ? renderTemplate(input.step.bodyHtml, input.contact)
      : `${renderedTextBody.replace(/\n/g, "<br />")}<br /><br /><a href="${input.unsubscribeLink}">Unsubscribe</a>`;
  const textBody = renderedTextBody.includes("Unsubscribe")
    ? renderedTextBody
    : `${renderedTextBody}\n\nUnsubscribe: ${input.unsubscribeLink}`;

  return {
    subject: renderedSubject,
    bodyText: textBody,
    bodyHtml: renderedHtmlBody.includes("Unsubscribe")
      ? renderedHtmlBody
      : `${renderedHtmlBody}<br /><br /><a href="${input.unsubscribeLink}">Unsubscribe</a>`,
    snippet: renderedTextBody.slice(0, 120),
  };
}

async function ensureOutboundMessageRecord(campaignContactId: string, stepNumber: number) {
  const existingResult = await supabase
    .from("outbound_messages")
    .select("id, status, sent_at, gmail_message_id, gmail_thread_id")
    .eq("campaign_contact_id", campaignContactId)
    .eq("step_number", stepNumber)
    .maybeSingle();

  if (existingResult.error) {
    throw existingResult.error;
  }

  const existing = existingResult.data as
    | {
        id: string;
        status?: string | null;
        sent_at?: string | null;
        gmail_message_id?: string | null;
        gmail_thread_id?: string | null;
      }
    | null;

  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("outbound_messages")
    .insert({
      campaign_contact_id: campaignContactId,
      step_number: stepNumber,
      status: "queued",
    })
    .select("id, status, sent_at, gmail_message_id, gmail_thread_id")
    .single();

  if (error) {
    throw error;
  }

  return data as {
    id: string;
    status?: string | null;
    sent_at?: string | null;
    gmail_message_id?: string | null;
    gmail_thread_id?: string | null;
  };
}

async function getCampaignDaySendCount(campaignId: string, timezone: string, baseAt: string) {
  const bounds = getDayBoundsInTimeZone(baseAt, timezone);
  const { count, error } = await supabase
    .from("outbound_messages")
    .select("id, campaign_contact:campaign_contacts!inner(campaign_id)", { count: "exact", head: true })
    .eq("campaign_contact.campaign_id", campaignId)
    .eq("status", "sent")
    .gte("sent_at", bounds.startIso)
    .lt("sent_at", bounds.endIso);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function loadReservedJobs(jobIds: string[]) {
  const { data, error } = await supabase
    .from("campaign_send_jobs")
    .select(
      `
      id,
      campaign_id,
      campaign_contact_id,
      step_number,
      status,
      scheduled_for,
      attempt_count,
      reservation_token,
      campaign_contact:campaign_contacts(
        id,
        contact_id,
        status,
        current_step,
        failed_attempts,
        last_thread_id,
        last_message_id,
        contact:contacts(
          email,
          first_name,
          last_name,
          company,
          website,
          job_title,
          custom_fields_jsonb,
          unsubscribed_at
        ),
        outbound_messages(id, step_number, status, sent_at, gmail_message_id, gmail_thread_id)
      ),
      campaign:campaigns(
        id,
        workspace_id,
        project_id,
        name,
        status,
        gmail_account_id,
        workflow_definition_jsonb,
        daily_send_limit,
        send_window_start,
        send_window_end,
        timezone,
        allowed_send_days,
        campaign_steps(step_number, step_type, subject_template, body_template, body_html_template, wait_days)
      )
    `,
    )
    .in("id", jobIds)
    .order("scheduled_for", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as ReservedJobRecord[] | null) ?? [];
}

Deno.serve(async (request) => {
  if (!verifyCron(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const campaignId =
    typeof payload.campaignId === "string" && payload.campaignId.trim().length ? payload.campaignId : null;
  const maxJobs = Math.max(
    1,
    Math.min(
      Number.isFinite(Number(payload.maxJobs))
        ? Number(payload.maxJobs)
        : config.defaultPerMinuteThrottle,
      250,
    ),
  );
  const ignoreSendWindow = payload.ignoreSendWindow === true;
  const runId = await startQueueRun({ campaignId, maxJobs, ignoreSendWindow });
  let processed = 0;
  let errorCount = 0;
  const workspaceSendCache = new Map<
    string,
    { billingStatus: string; dailyLimit: number; monthlyLimit: number; dailyUsed: number; monthlyUsed: number }
  >();
  const campaignSendCache = new Map<string, number>();

  try {
    const reservationToken = crypto.randomUUID();
    const { data: rawReservedJobs, error: reserveError } = await supabase.rpc("reserve_campaign_send_jobs", {
      p_campaign_id: campaignId,
      p_limit: maxJobs,
      p_now: new Date().toISOString(),
      p_reservation_token: reservationToken,
    });

    if (reserveError) {
      throw reserveError;
    }

    const reservedJobs = (rawReservedJobs as Array<{ id: string }> | null) ?? [];

    if (!reservedJobs.length) {
      await updateQueueRun(runId, {
        status: "success",
        processedCount: 0,
        errorCount: 0,
        metadata: { campaignId, maxJobs, ignoreSendWindow },
      });
      return json({ processed: 0, reserved: 0 });
    }

    const jobs = await loadReservedJobs(reservedJobs.map((job) => job.id));

    for (const job of jobs) {
      const campaign = job.campaign;
      const campaignContact = job.campaign_contact;
      const contact = campaignContact?.contact;
      const nowIso = new Date().toISOString();

      if (!campaign || !campaignContact || !contact) {
        await cancelCurrentJob({
          jobId: job.id,
          campaignContactId: job.campaign_contact_id,
          reason: "Missing campaign or contact data",
        });
        errorCount += 1;
        continue;
      }

      if (campaign.status !== "active") {
        const scheduledFor = computeNextWindowStartAt({
          baseAt: nowIso,
          timezone: campaign.timezone,
          sendWindowStart: campaign.send_window_start,
          allowedSendDays: campaign.allowed_send_days ?? undefined,
        });
        await releaseReservedJob({
          jobId: job.id,
          campaignContactId: campaignContact.id,
          scheduledFor,
          lastError: "Campaign is paused or inactive.",
        });
        continue;
      }

      if (
        contact.unsubscribed_at ||
        isTerminalCampaignContactStatus(campaignContact.status) ||
        ["unsubscribed", "replied", "meeting_booked"].includes(campaignContact.status)
      ) {
        await cancelCurrentJob({
          jobId: job.id,
          campaignContactId: campaignContact.id,
          reason: "Contact is no longer eligible for follow-up.",
        });
        continue;
      }

      if (
        !ignoreSendWindow &&
        (!isWithinAllowedSendDay(new Date(), campaign.timezone, campaign.allowed_send_days ?? undefined) ||
          !isWithinSendWindow(
            new Date(),
            campaign.timezone,
            campaign.send_window_start,
            campaign.send_window_end,
          ))
      ) {
        const scheduledFor = computeNextScheduledSendAt({
          baseSentAt: nowIso,
          waitDays: 0,
          timezone: campaign.timezone,
          sendWindowStart: campaign.send_window_start,
          sendWindowEnd: campaign.send_window_end,
          allowedSendDays: campaign.allowed_send_days ?? undefined,
        });
        await releaseReservedJob({
          jobId: job.id,
          campaignContactId: campaignContact.id,
          scheduledFor,
          lastError: "Outside send window.",
        });
        continue;
      }

      const workflowSteps = normalizeWorkflowDefinition(
        campaign.workflow_definition_jsonb,
        (campaign.campaign_steps as Array<Record<string, unknown>> | null | undefined) ?? [],
      );
      const step = workflowSteps.find((candidate) => Number(candidate.stepNumber) === Number(job.step_number));

      if (!step || !contact.email) {
        await cancelCurrentJob({
          jobId: job.id,
          campaignContactId: campaignContact.id,
          reason: "Workflow step or recipient email is missing.",
          campaignContactStatus: "failed",
          currentStep: job.step_number,
        });
        errorCount += 1;
        continue;
      }

      if (step.stepNumber > 1) {
        const previousStepNumber = step.stepNumber - 1;
        const { data: rawEvents, error: eventsError } = await supabase
          .from("message_events")
          .select("event_type, metadata")
          .eq("campaign_contact_id", campaignContact.id)
          .order("occurred_at", { ascending: true });

        if (eventsError) {
          throw eventsError;
        }

        const resolution = resolveWorkflowAdvance(
          workflowSteps,
          previousStepNumber,
          (rawEvents as Array<{
            event_type: string;
            metadata?: { stepNumber?: number | string | null } | null;
          }> | null) ?? [],
        );

        if (resolution.action !== "advance" || Number(resolution.nextStep.stepNumber) !== step.stepNumber) {
          await cancelCurrentJob({
            jobId: job.id,
            campaignContactId: campaignContact.id,
            reason: resolution.exitReason ?? "Sequence exited before the follow-up step.",
            campaignContactStatus: previousStepNumber > 1 ? "followup_sent" : "sent",
            currentStep: previousStepNumber,
          });
          continue;
        }
      }

      let workspaceSendState = workspaceSendCache.get(campaign.workspace_id);

      if (!workspaceSendState) {
        workspaceSendState = await getWorkspaceSendState(campaign.workspace_id);
        workspaceSendCache.set(campaign.workspace_id, workspaceSendState);
      }

      if (!["active", "trialing"].includes(workspaceSendState.billingStatus)) {
        await releaseReservedJob({
          jobId: job.id,
          campaignContactId: campaignContact.id,
          scheduledFor: computeRetryScheduledAt({
            baseAt: nowIso,
            retryDelayMinutes: 60,
            timezone: campaign.timezone,
            sendWindowStart: campaign.send_window_start,
            sendWindowEnd: campaign.send_window_end,
            allowedSendDays: campaign.allowed_send_days ?? undefined,
          }),
          lastError: "Workspace billing status is not active for sending.",
        });
        continue;
      }

      if (workspaceSendState.dailyUsed >= workspaceSendState.dailyLimit) {
        await releaseReservedJob({
          jobId: job.id,
          campaignContactId: campaignContact.id,
          scheduledFor: computeRetryScheduledAt({
            baseAt: nowIso,
            retryDelayMinutes: 60,
            timezone: campaign.timezone,
            sendWindowStart: campaign.send_window_start,
            sendWindowEnd: campaign.send_window_end,
            allowedSendDays: campaign.allowed_send_days ?? undefined,
          }),
          lastError: "Workspace daily send limit reached.",
        });
        continue;
      }

      if (workspaceSendState.monthlyUsed >= workspaceSendState.monthlyLimit) {
        await releaseReservedJob({
          jobId: job.id,
          campaignContactId: campaignContact.id,
          scheduledFor: computeRetryScheduledAt({
            baseAt: nowIso,
            retryDelayMinutes: 360,
            timezone: campaign.timezone,
            sendWindowStart: campaign.send_window_start,
            sendWindowEnd: campaign.send_window_end,
            allowedSendDays: campaign.allowed_send_days ?? undefined,
          }),
          lastError: "Workspace monthly send limit reached.",
        });
        continue;
      }

      const campaignDateKey = `${campaign.id}:${getDateKeyInTimeZone(nowIso, campaign.timezone)}`;
      let sentToday = campaignSendCache.get(campaignDateKey);

      if (typeof sentToday === "undefined") {
        sentToday = await getCampaignDaySendCount(campaign.id, campaign.timezone, nowIso);
        campaignSendCache.set(campaignDateKey, sentToday);
      }

      if (sentToday >= campaign.daily_send_limit) {
        const scheduledFor = computeNextWindowStartAt({
          baseAt: nowIso,
          timezone: campaign.timezone,
          sendWindowStart: campaign.send_window_start,
          allowedSendDays: campaign.allowed_send_days ?? undefined,
        });
        await releaseReservedJob({
          jobId: job.id,
          campaignContactId: campaignContact.id,
          scheduledFor,
          lastError: "Campaign daily send limit reached for the current day.",
        });
        continue;
      }

      const { data: mailbox, error: mailboxError } = await supabase
        .from("gmail_accounts")
        .select(
          "id, project_id, email_address, approval_status, oauth_connection:oauth_connections(id, access_token_encrypted, refresh_token_encrypted, token_expiry)",
        )
        .eq("id", campaign.gmail_account_id)
        .single();

      if (mailboxError) {
        throw mailboxError;
      }

      if (!mailbox || (mailbox.approval_status && mailbox.approval_status !== "approved")) {
        await releaseReservedJob({
          jobId: job.id,
          campaignContactId: campaignContact.id,
          scheduledFor: computeRetryScheduledAt({
            baseAt: nowIso,
            retryDelayMinutes: 60,
            timezone: campaign.timezone,
            sendWindowStart: campaign.send_window_start,
            sendWindowEnd: campaign.send_window_end,
            allowedSendDays: campaign.allowed_send_days ?? undefined,
          }),
          lastError: "Mailbox is not ready for sending.",
        });
        continue;
      }

      const provisionalOutbound = await ensureOutboundMessageRecord(campaignContact.id, step.stepNumber);

      if (provisionalOutbound.sent_at || provisionalOutbound.status === "sent") {
        const recoveredSentAt = provisionalOutbound.sent_at ?? nowIso;
        const nextStep = workflowSteps.find(
          (candidate) => Number(candidate.stepNumber) === Number(step.stepNumber) + 1,
        );
        await updateJob(job.id, {
          status: "sent",
          processed_at: recoveredSentAt,
          reservation_token: null,
          last_error: null,
        });

        if (nextStep) {
          const scheduledFor = computeNextScheduledSendAt({
            baseSentAt: recoveredSentAt,
            waitDays: Number(step.waitDays ?? config.followUpDelayDays),
            timezone: campaign.timezone,
            sendWindowStart: campaign.send_window_start,
            sendWindowEnd: campaign.send_window_end,
            allowedSendDays: campaign.allowed_send_days ?? undefined,
          });
          await queueNextStep({
            campaign,
            campaignContact: {
              ...campaignContact,
              last_thread_id: provisionalOutbound.gmail_thread_id ?? campaignContact.last_thread_id,
              last_message_id: provisionalOutbound.gmail_message_id ?? campaignContact.last_message_id,
            },
            nextStep,
            scheduledFor,
          });
          await supabase
            .from("campaign_contacts")
            .update({
              last_thread_id: provisionalOutbound.gmail_thread_id ?? campaignContact.last_thread_id ?? null,
              last_message_id: provisionalOutbound.gmail_message_id ?? campaignContact.last_message_id ?? null,
              error_message: null,
            })
            .eq("id", campaignContact.id);
        } else {
          await supabase
            .from("campaign_contacts")
            .update({
              status: step.stepNumber > 1 ? "followup_sent" : "sent",
              current_step: step.stepNumber,
              next_due_at: null,
              last_thread_id: provisionalOutbound.gmail_thread_id ?? campaignContact.last_thread_id ?? null,
              last_message_id: provisionalOutbound.gmail_message_id ?? campaignContact.last_message_id ?? null,
              error_message: null,
            })
            .eq("id", campaignContact.id);
        }

        await syncCampaignContactNextDueAt(campaignContact.id);
        continue;
      }

      try {
        const accessToken = await resolveMailboxAccess(mailbox);
        const unsubscribeToken = crypto.randomUUID();
        const unsubscribeLink = `${Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000"}/api/unsubscribes/${unsubscribeToken}`;
        const rendered = buildRenderedContent({
          step,
          contact,
          unsubscribeLink,
        });
        const trackedHtml = await instrumentHtmlForTracking({
          workspaceId: campaign.workspace_id,
          campaignContactId: campaignContact.id,
          stepNumber: step.stepNumber,
          html: rendered.bodyHtml,
        });
        const sendResult = await gmailSend({
          accessToken,
          fromEmail: mailbox.email_address,
          toEmail: contact.email,
          subject: rendered.subject,
          bodyHtml: trackedHtml,
          threadId: step.stepNumber > 1 ? campaignContact.last_thread_id ?? null : null,
        });

        const sentAt = new Date().toISOString();
        const nextStep = workflowSteps.find(
          (candidate) => Number(candidate.stepNumber) === Number(step.stepNumber) + 1,
        );

        await supabase
          .from("outbound_messages")
          .update({
            gmail_message_id: sendResult.id ?? null,
            gmail_thread_id: sendResult.threadId ?? null,
            sent_at: sentAt,
            status: "sent",
            error_message: null,
          })
          .eq("id", provisionalOutbound.id);

        await supabase.from("message_threads").upsert({
          workspace_id: campaign.workspace_id,
          project_id: campaign.project_id,
          campaign_contact_id: campaignContact.id,
          gmail_thread_id: sendResult.threadId || sendResult.id || crypto.randomUUID(),
          subject: rendered.subject,
          snippet: rendered.snippet,
          latest_message_at: sentAt,
        });

        await upsertUnsubscribeRecord({
          workspaceId: campaign.workspace_id,
          contactId: campaignContact.contact_id,
          email: contact.email,
          token: unsubscribeToken,
        });

        await supabase.from("message_events").insert({
          workspace_id: campaign.workspace_id,
          campaign_contact_id: campaignContact.id,
          outbound_message_id: provisionalOutbound.id,
          gmail_message_id: sendResult.id ?? null,
          event_type: "sent",
          metadata: {
            stepNumber: step.stepNumber,
            subject: rendered.subject,
            toEmail: contact.email,
          },
        });
        await enqueueCrmWritebackJobs({
          supabase,
          workspaceId: campaign.workspace_id,
          campaignContactId: campaignContact.id,
          eventType: "sent",
          metadata: {
            stepNumber: step.stepNumber,
            subject: rendered.subject,
          },
        });

        await updateJob(job.id, {
          status: "sent",
          processed_at: sentAt,
          reservation_token: null,
          last_error: null,
          attempt_count: job.attempt_count,
        });

        if (nextStep) {
          const scheduledFor = computeNextScheduledSendAt({
            baseSentAt: sentAt,
            waitDays: Number(step.waitDays ?? config.followUpDelayDays),
            timezone: campaign.timezone,
            sendWindowStart: campaign.send_window_start,
            sendWindowEnd: campaign.send_window_end,
            allowedSendDays: campaign.allowed_send_days ?? undefined,
          });
          await queueNextStep({
            campaign,
            campaignContact,
            nextStep,
            scheduledFor,
          });
          await supabase
            .from("campaign_contacts")
            .update({
              last_thread_id: sendResult.threadId ?? null,
              last_message_id: sendResult.id ?? null,
              error_message: null,
            })
            .eq("id", campaignContact.id);
        } else {
          await supabase
            .from("campaign_contacts")
            .update({
              status: step.stepNumber > 1 ? "followup_sent" : "sent",
              current_step: step.stepNumber,
              next_due_at: null,
              last_thread_id: sendResult.threadId ?? null,
              last_message_id: sendResult.id ?? null,
              error_message: null,
            })
            .eq("id", campaignContact.id);
        }

        workspaceSendState.dailyUsed += 1;
        workspaceSendState.monthlyUsed += 1;
        campaignSendCache.set(campaignDateKey, sentToday + 1);
        processed += 1;
      } catch (sendError) {
        const message =
          sendError instanceof Error ? sendError.message : "Unknown send error";
        const attemptCount = job.attempt_count + 1;

        await supabase
          .from("outbound_messages")
          .update({
            status: "failed",
            error_message: message,
          })
          .eq("id", provisionalOutbound.id);

        if (attemptCount >= MAX_JOB_ATTEMPTS || isPermanentSendError(message)) {
          await updateJob(job.id, {
            status: "failed",
            processed_at: new Date().toISOString(),
            reservation_token: null,
            last_error: message,
            attempt_count: attemptCount,
          });
          await supabase
            .from("campaign_contacts")
            .update({
              status: "failed",
              next_due_at: null,
              error_message: message,
              failed_attempts: campaignContact.failed_attempts + 1,
            })
            .eq("id", campaignContact.id);
        } else {
          const scheduledFor = computeRetryScheduledAt({
            baseAt: nowIso,
            retryDelayMinutes: getRetryDelayMinutes(attemptCount),
            timezone: campaign.timezone,
            sendWindowStart: campaign.send_window_start,
            sendWindowEnd: campaign.send_window_end,
            allowedSendDays: campaign.allowed_send_days ?? undefined,
          });
          await updateJob(job.id, {
            status: "pending",
            scheduled_for: scheduledFor,
            reserved_at: null,
            reservation_token: null,
            last_error: message,
            attempt_count: attemptCount,
          });
          await supabase
            .from("campaign_contacts")
            .update({
              status: step.stepNumber > 1 ? "followup_due" : "queued",
              current_step: step.stepNumber,
              next_due_at: scheduledFor,
              error_message: message,
              failed_attempts: campaignContact.failed_attempts + 1,
            })
            .eq("id", campaignContact.id);
        }

        errorCount += 1;
      }
    }

    await updateQueueRun(runId, {
      status: errorCount === 0 ? "success" : processed > 0 ? "partial" : "error",
      processedCount: processed,
      errorCount,
      metadata: { campaignId, maxJobs, ignoreSendWindow, reserved: jobs.length },
    });

    return json({
      processed,
      reserved: jobs.length,
      errors: errorCount,
    });
  } catch (error) {
    console.error("send-due-messages failed", error);
    await updateQueueRun(runId, {
      status: "error",
      processedCount: processed,
      errorCount: errorCount + 1,
      metadata: {
        campaignId,
        maxJobs,
        ignoreSendWindow,
        error: error instanceof Error ? error.message : "Unknown worker error",
      },
    });
    return json(
      {
        error: error instanceof Error ? error.message : "Unknown send queue error",
        processed,
      },
      { status: 500 },
    );
  }
});
