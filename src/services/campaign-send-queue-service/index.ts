import "server-only";
import { randomUUID } from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireSupabaseConfiguration } from "@/lib/supabase/env";
import { isMissingTableError } from "@/lib/utils/supabase-schema";
import {
  computeNextScheduledSendAt,
  computeNextWindowStartAt,
  isTerminalCampaignContactStatus,
} from "@/lib/campaigns/send-queue-shared";
import { normalizeWorkflowDefinition, type CampaignWorkflowDefinition } from "@/lib/workflows/definition";

const ACTIVE_QUEUE_JOB_STATUSES = ["pending", "reserved"] as const;

type QueueJobRecord = {
  id: string;
  campaign_contact_id: string;
  step_number: number;
  status: string;
  scheduled_for: string;
  attempt_count: number;
};

type CampaignContactSnapshot = {
  id: string;
  status: string;
  current_step: number;
  next_due_at?: string | null;
  replied_at?: string | null;
  contact?: {
    unsubscribed_at?: string | null;
  } | null;
  outbound_messages?: Array<{
    step_number: number;
    sent_at?: string | null;
    status?: string | null;
  }> | null;
};

type CampaignSnapshot = {
  id: string;
  workspace_id: string;
  project_id: string;
  status: string;
  timezone: string;
  send_window_start: string;
  send_window_end: string;
  allowed_send_days?: string[] | null;
  workflow_definition_jsonb?: Partial<CampaignWorkflowDefinition> | null;
  campaign_steps?: Array<{
    step_number: number;
    step_type?: string | null;
    subject_template: string;
    body_template: string;
    body_html_template?: string | null;
    wait_days?: number | null;
  }> | null;
  campaign_contacts?: CampaignContactSnapshot[] | null;
};

type QueueErrorLike = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
} | null | undefined;

function isMissingRpcError(message: string | null | undefined, rpcName: string) {
  const normalized = (message ?? "").toLowerCase();
  const rpc = rpcName.toLowerCase();

  return normalized.includes(rpc) && (normalized.includes("does not exist") || normalized.includes("schema cache"));
}

function isQueueSchemaMissingError(error: QueueErrorLike) {
  const message = error?.message?.toLowerCase() ?? "";

  return (
    isMissingTableError(error?.message, "campaign_send_jobs") ||
    isMissingTableError(error?.message, "campaign_queue_runs") ||
    isMissingRpcError(error?.message, "reserve_campaign_send_jobs") ||
    message.includes("schema cache") && message.includes("campaign send queue")
  );
}

export function isQueueSchemaCompatibilityError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const queueError = error as QueueErrorLike;
  const message = queueError?.message?.toLowerCase() ?? "";

  return (
    isQueueSchemaMissingError(queueError) ||
    message.includes("campaign send queue requires the latest supabase migrations") ||
    message.includes("campaign send queue requires the current supabase queue schema")
  );
}

function getQueueErrorMessage(context: string, error: QueueErrorLike, fallback: string) {
  if (isQueueSchemaMissingError(error)) {
    return (
      `Campaign send queue requires the current Supabase queue schema. Failed during ${context}: ` +
      "apply the send queue migration if it has not been run, then run NOTIFY pgrst, 'reload schema'; " +
      "in the Supabase SQL Editor and reload the app."
    );
  }

  const parts = [error?.message, error?.details, error?.hint]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (parts.length) {
    return `Failed during ${context}: ${parts.join(" ")}`;
  }

  return fallback;
}

function toQueueError(context: string, error: QueueErrorLike, fallback: string) {
  return new Error(getQueueErrorMessage(context, error, fallback));
}

function getQueuedContactStatus(stepNumber: number) {
  return stepNumber > 1 ? "followup_due" : "queued";
}

async function syncCampaignContactNextDueAt(campaignContactId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("campaign_send_jobs")
    .select("scheduled_for")
    .eq("campaign_contact_id", campaignContactId)
    .in("status", [...ACTIVE_QUEUE_JOB_STATUSES])
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw toQueueError("loading the next due send job", error, "Failed to load the next due campaign send job.");
  }

  const scheduledFor = (data as { scheduled_for?: string | null } | null)?.scheduled_for ?? null;
  const { error: updateError } = await supabase
    .from("campaign_contacts")
    .update({ next_due_at: scheduledFor })
    .eq("id", campaignContactId);

  if (updateError) {
    throw toQueueError("updating campaign contact due time", updateError, "Failed to update the campaign contact due time.");
  }

  return scheduledFor;
}

async function getExistingQueueJob(campaignContactId: string, stepNumber: number) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("campaign_send_jobs")
    .select("id, campaign_contact_id, step_number, status, scheduled_for, attempt_count")
    .eq("campaign_contact_id", campaignContactId)
    .eq("step_number", stepNumber)
    .maybeSingle();

  if (error) {
    throw toQueueError("loading an existing queued step", error, "Failed to load the existing queued campaign step.");
  }

  return (data as QueueJobRecord | null) ?? null;
}

async function updateCampaignContactQueueState(input: {
  campaignContactId: string;
  status: string;
  currentStep: number;
  nextDueAt: string | null;
  errorMessage?: string | null;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("campaign_contacts")
    .update({
      status: input.status,
      current_step: input.currentStep,
      next_due_at: input.nextDueAt,
      error_message: input.errorMessage ?? null,
    })
    .eq("id", input.campaignContactId);

  if (error) {
    throw toQueueError("updating the campaign contact queue state", error, "Failed to update the campaign contact queue state.");
  }
}

async function cancelOtherPendingCampaignJobs(campaignContactId: string, keepStepNumber: number) {
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("campaign_send_jobs")
    .update({
      status: "canceled",
      canceled_at: now,
      processed_at: now,
      last_error: "Replaced by refreshed campaign schedule",
      reservation_token: null,
    })
    .eq("campaign_contact_id", campaignContactId)
    .in("status", [...ACTIVE_QUEUE_JOB_STATUSES])
    .not("step_number", "eq", keepStepNumber);

  if (error) {
    throw toQueueError("canceling replaced queued steps", error, "Failed to cancel replaced queued campaign steps.");
  }
}

export async function enqueueCampaignStepJob(input: {
  workspaceId: string;
  projectId: string;
  campaignId: string;
  campaignContactId: string;
  stepNumber: number;
  scheduledFor: string;
}) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const existingJob = await getExistingQueueJob(input.campaignContactId, input.stepNumber);

  if (existingJob?.status === "sent") {
    await syncCampaignContactNextDueAt(input.campaignContactId);
    return existingJob;
  }

  const payload = {
    workspace_id: input.workspaceId,
    project_id: input.projectId,
    campaign_id: input.campaignId,
    campaign_contact_id: input.campaignContactId,
    step_number: input.stepNumber,
    scheduled_for: input.scheduledFor,
    status: "pending",
    reserved_at: null,
    processed_at: null,
    canceled_at: null,
    attempt_count: 0,
    last_error: null,
    reservation_token: null,
  };

  const result = existingJob
    ? await supabase
        .from("campaign_send_jobs")
        .update(payload)
        .eq("id", existingJob.id)
        .select("id, campaign_contact_id, step_number, status, scheduled_for, attempt_count")
        .single()
    : await supabase
        .from("campaign_send_jobs")
        .insert(payload)
        .select("id, campaign_contact_id, step_number, status, scheduled_for, attempt_count")
        .single();

  if (result.error) {
    throw toQueueError("saving a queued campaign step", result.error, "Failed to save the queued campaign step.");
  }

  const job = result.data as QueueJobRecord;
  await updateCampaignContactQueueState({
    campaignContactId: input.campaignContactId,
    status: getQueuedContactStatus(input.stepNumber),
    currentStep: input.stepNumber,
    nextDueAt: input.scheduledFor,
    errorMessage: null,
  });

  return job;
}

export async function cancelPendingCampaignJobs(
  campaignContactId: string,
  options?: {
    reason?: string | null;
    clearNextDueAt?: boolean;
  },
) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("campaign_send_jobs")
    .update({
      status: "canceled",
      canceled_at: now,
      processed_at: now,
      last_error: options?.reason ?? null,
      reservation_token: null,
    })
    .eq("campaign_contact_id", campaignContactId)
    .in("status", [...ACTIVE_QUEUE_JOB_STATUSES]);

  if (error) {
    throw toQueueError("canceling queued campaign steps", error, "Failed to cancel queued campaign steps.");
  }

  if (options?.clearNextDueAt === false) {
    return;
  }

  await supabase
    .from("campaign_contacts")
    .update({ next_due_at: null })
    .eq("id", campaignContactId);
}

export async function reserveDueCampaignJobs(input?: {
  campaignId?: string | null;
  limit?: number;
  nowIso?: string;
}) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient() as unknown as {
    rpc: (
      fn: string,
      params?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message?: string | null } | null }>;
  };

  const reservationToken = randomUUID();
  const { data, error } = await supabase.rpc("reserve_campaign_send_jobs", {
    p_campaign_id: input?.campaignId ?? null,
    p_limit: input?.limit ?? 25,
    p_now: input?.nowIso ?? new Date().toISOString(),
    p_reservation_token: reservationToken,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to reserve campaign send jobs.");
  }

  return {
    reservationToken,
    jobs: (data as QueueJobRecord[] | null) ?? [],
  };
}

function getStepScheduleConfig(campaign: CampaignSnapshot) {
  return {
    timezone: campaign.timezone,
    sendWindowStart: campaign.send_window_start,
    sendWindowEnd: campaign.send_window_end,
    allowedSendDays: campaign.allowed_send_days ?? undefined,
  };
}

function getSentMessages(contact: CampaignContactSnapshot) {
  return [...(contact.outbound_messages ?? [])]
    .filter((message) => Boolean(message.sent_at))
    .sort((left, right) => left.step_number - right.step_number);
}

function getLastSentMessage(contact: CampaignContactSnapshot) {
  const sentMessages = getSentMessages(contact);
  return sentMessages[sentMessages.length - 1] ?? null;
}

async function loadCampaignForQueueReconciliation(campaignId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      `
      id,
      workspace_id,
      project_id,
      status,
      timezone,
      send_window_start,
      send_window_end,
      allowed_send_days,
      workflow_definition_jsonb,
      campaign_steps(step_number, step_type, subject_template, body_template, body_html_template, wait_days),
      campaign_contacts(
        id,
        status,
        current_step,
        next_due_at,
        replied_at,
        contact:contacts(unsubscribed_at),
        outbound_messages(step_number, sent_at, status)
      )
    `,
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    throw toQueueError("loading the campaign queue snapshot", error, "Failed to load the campaign queue snapshot.");
  }

  return (data as CampaignSnapshot | null) ?? null;
}

export async function reconcileCampaignJobs(campaignId: string) {
  requireSupabaseConfiguration();

  const campaign = await loadCampaignForQueueReconciliation(campaignId);

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const workflowDefinition = normalizeWorkflowDefinition({
    steps:
      (campaign.workflow_definition_jsonb?.steps as CampaignWorkflowDefinition["steps"] | undefined) ??
      undefined,
  });
  const fallbackWorkflow = normalizeWorkflowDefinition({
    steps: (campaign.campaign_steps ?? []).map((step) => ({
      name: step.step_type === "follow_up" ? "Follow-up" : `Step ${step.step_number}`,
      waitDays: Number(step.wait_days ?? 0),
      branchCondition: "time",
      onMatch: step.step_type === "follow_up" ? "exit_sequence" : "next_step",
      onNoMatch: step.step_type === "follow_up" ? "exit_sequence" : "next_step",
      subject: step.subject_template,
      mode: step.body_html_template ? "html" : "text",
      body: step.body_template,
      bodyHtml: step.body_html_template ?? "",
    })),
  });
  const resolvedWorkflow = workflowDefinition.steps.length ? workflowDefinition : fallbackWorkflow;
  const nowIso = new Date().toISOString();

  for (const contact of campaign.campaign_contacts ?? []) {
    if (
      contact.status === "failed" ||
      isTerminalCampaignContactStatus(contact.status) ||
      contact.contact?.unsubscribed_at
    ) {
      await cancelPendingCampaignJobs(contact.id, {
        reason: contact.contact?.unsubscribed_at ? "Contact unsubscribed" : "Contact no longer eligible",
      });
      continue;
    }

    const lastSentMessage = getLastSentMessage(contact);
    const nextStepNumber = lastSentMessage ? lastSentMessage.step_number + 1 : 1;
    const nextStep = resolvedWorkflow.steps.find((step) => step.stepNumber === nextStepNumber);

    if (!nextStep) {
      await cancelPendingCampaignJobs(contact.id, { reason: "Workflow complete" });
      await updateCampaignContactQueueState({
        campaignContactId: contact.id,
        status: lastSentMessage && lastSentMessage.step_number > 1 ? "followup_sent" : "sent",
        currentStep: lastSentMessage?.step_number ?? contact.current_step,
        nextDueAt: null,
        errorMessage: null,
      });
      continue;
    }

    const scheduledFor = lastSentMessage?.sent_at
      ? computeNextScheduledSendAt({
          baseSentAt: lastSentMessage.sent_at,
          waitDays: Number(
            resolvedWorkflow.steps.find((step) => step.stepNumber === lastSentMessage.step_number)?.waitDays ?? 0,
          ),
          ...getStepScheduleConfig(campaign),
        })
      : computeNextScheduledSendAt({
          baseSentAt: nowIso,
          waitDays: 0,
          ...getStepScheduleConfig(campaign),
        });

    await cancelOtherPendingCampaignJobs(contact.id, nextStepNumber);
    await enqueueCampaignStepJob({
      workspaceId: campaign.workspace_id,
      projectId: campaign.project_id,
      campaignId: campaign.id,
      campaignContactId: contact.id,
      stepNumber: nextStepNumber,
      scheduledFor,
    });
  }
}

export async function requeueFailedCampaignContact(campaignContactId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("campaign_contacts")
    .select(
      `
      id,
      current_step,
      campaign:campaigns(
        id,
        workspace_id,
        project_id,
        timezone,
        send_window_start,
        send_window_end,
        allowed_send_days
      )
    `,
    )
    .eq("id", campaignContactId)
    .maybeSingle();

  if (error) {
    throw toQueueError("loading the failed campaign contact", error, "Failed to load the failed campaign contact.");
  }

  const record = data as
    | {
        id: string;
        current_step: number;
        campaign?: {
          id: string;
          workspace_id: string;
          project_id: string;
          timezone: string;
          send_window_start: string;
          send_window_end: string;
          allowed_send_days?: string[] | null;
        } | null;
      }
    | null;

  if (!record?.campaign) {
    throw new Error("Campaign contact not found.");
  }

  const scheduledFor = computeNextWindowStartAt({
    baseAt: new Date().toISOString(),
    timezone: record.campaign.timezone,
    sendWindowStart: record.campaign.send_window_start,
    allowedSendDays: record.campaign.allowed_send_days ?? undefined,
    includeToday: true,
  });

  await enqueueCampaignStepJob({
    workspaceId: record.campaign.workspace_id,
    projectId: record.campaign.project_id,
    campaignId: record.campaign.id,
    campaignContactId: record.id,
    stepNumber: record.current_step,
    scheduledFor,
  });

  return {
    campaignContactId: record.id,
    status: getQueuedContactStatus(record.current_step),
    scheduledFor,
  };
}

export async function getCampaignSendQueueHealth(workspaceId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const [oldestDueResult, failedJobsResult, pendingJobsResult, lastRunResult] = await Promise.all([
    supabase
      .from("campaign_send_jobs")
      .select("scheduled_for")
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("campaign_send_jobs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "failed"),
    supabase
      .from("campaign_send_jobs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "pending"),
    supabase
      .from("campaign_queue_runs")
      .select("finished_at, processed_count, error_count")
      .eq("worker_name", "send-due-messages")
      .eq("status", "success")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (oldestDueResult.error) {
    throw toQueueError("loading queue health", oldestDueResult.error, "Failed to load campaign queue health.");
  }

  if (failedJobsResult.error) {
    throw toQueueError("loading queue health", failedJobsResult.error, "Failed to load campaign queue health.");
  }

  if (pendingJobsResult.error) {
    throw toQueueError("loading queue health", pendingJobsResult.error, "Failed to load campaign queue health.");
  }

  if (lastRunResult.error) {
    throw toQueueError("loading queue health", lastRunResult.error, "Failed to load campaign queue health.");
  }

  return {
    oldestPendingDueAt:
      (oldestDueResult.data as { scheduled_for?: string | null } | null)?.scheduled_for ?? null,
    failedJobCount: failedJobsResult.count ?? 0,
    pendingJobCount: pendingJobsResult.count ?? 0,
    lastSuccessfulRun:
      (lastRunResult.data as { finished_at?: string | null; processed_count?: number | null; error_count?: number | null } | null) ??
      null,
  };
}
