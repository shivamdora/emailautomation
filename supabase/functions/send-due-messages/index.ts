import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "https://esm.sh/jose@6.2.1";
import { config } from "../shared/config.ts";
import { decryptToken, encryptToken } from "../shared/crypto.ts";
import { enqueueCrmWritebackJobs } from "../shared/crm.ts";
import { gmailRefreshAccessToken, gmailSend } from "../shared/gmail.ts";
import { json } from "../shared/response.ts";

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);

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
      `href=${quote}${appUrl}/api/track/click?token=${encodeURIComponent(clickToken)}${quote}`,
    );
  }

  return `${trackedHtml}${openPixel}`;
}

function isWithinSendWindow(timezone: string, start: string, end: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
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
  }));
}

function resolveWorkflowAdvance(
  workflowSteps: Array<Record<string, unknown>>,
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
      ? {
          action: "advance",
          nextStep,
          matched: true,
          reason: "time_elapsed",
        }
      : {
          action: "exit",
          exitReason: "time_elapsed_exit",
        };
  }

  const matched = events.some(
    (event) =>
      event.event_type === (condition === "opened" ? "opened" : "clicked") &&
      Number(event.metadata?.stepNumber ?? 0) === stepNumber,
  );
  const outcome = matched ? String(currentStep.onMatch ?? "next_step") : String(currentStep.onNoMatch ?? "next_step");

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
      .gte("sent_at", new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())).toISOString()),
    supabase
      .from("outbound_messages")
      .select("id, campaign_contact:campaign_contacts!inner(campaign:campaigns!inner(workspace_id))", {
        count: "exact",
        head: true,
      })
      .eq("campaign_contact.campaign.workspace_id", workspaceId)
      .eq("status", "sent")
      .gte("sent_at", new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()),
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

Deno.serve(async (request) => {
  if (!verifyCron(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: dueContacts, error } = await supabase
    .from("campaign_contacts")
    .select(`
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
      contact:contacts(email, first_name, company, website, custom_fields_jsonb, unsubscribed_at),
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
        campaign_steps(step_number, subject_template, body_template, body_html_template, wait_days)
      ),
      outbound_messages(step_number)
    `)
    .in("status", ["queued", "followup_due", "sent"])
    .lte("next_due_at", new Date().toISOString())
    .order("next_due_at", { ascending: true })
    .limit(config.defaultPerMinuteThrottle);

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  const workspaceSendCache = new Map<
    string,
    { billingStatus: string; dailyLimit: number; monthlyLimit: number; dailyUsed: number; monthlyUsed: number }
  >();

  for (const item of dueContacts ?? []) {
    const campaign = item.campaign;
    const contact = item.contact;

    if (!campaign || !contact || campaign.status !== "active" || contact.unsubscribed_at) {
      continue;
    }
    if (!isWithinSendWindow(campaign.timezone, campaign.send_window_start, campaign.send_window_end)) {
      continue;
    }

    const workflowSteps = normalizeWorkflowDefinition(
      campaign.workflow_definition_jsonb,
      (item.campaign?.campaign_steps as Array<Record<string, unknown>> | null | undefined) ?? [],
    );
    const step = workflowSteps.find((candidate) => Number(candidate.stepNumber) === Number(item.current_step));

    if (!step) {
      continue;
    }

    let workspaceSendState = workspaceSendCache.get(campaign.workspace_id);

    if (!workspaceSendState) {
      workspaceSendState = await getWorkspaceSendState(campaign.workspace_id);
      workspaceSendCache.set(campaign.workspace_id, workspaceSendState);
    }

    if (!["active", "trialing"].includes(workspaceSendState.billingStatus)) {
      await supabase
        .from("campaign_contacts")
        .update({
          error_message: "Workspace billing status is not active for sending.",
          next_due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .eq("id", item.id);
      continue;
    }

    if (workspaceSendState.dailyUsed >= workspaceSendState.dailyLimit) {
      await supabase
        .from("campaign_contacts")
        .update({
          error_message: "Workspace daily send limit reached.",
          next_due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .eq("id", item.id);
      continue;
    }

    if (workspaceSendState.monthlyUsed >= workspaceSendState.monthlyLimit) {
      await supabase
        .from("campaign_contacts")
        .update({
          error_message: "Workspace monthly send limit reached.",
          next_due_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", item.id);
      continue;
    }

    const { data: mailbox } = await supabase
      .from("gmail_accounts")
      .select("id, email_address, approval_status, oauth_connection:oauth_connections(id, access_token_encrypted, refresh_token_encrypted, token_expiry)")
      .eq("id", campaign.gmail_account_id)
      .single();

    if (!mailbox || (mailbox.approval_status && mailbox.approval_status !== "approved")) {
      continue;
    }

    const existingMessage = (item.outbound_messages as Array<{ step_number: number }> | null)?.find(
      (message) => message.step_number === item.current_step,
    );

    if (existingMessage) {
      const { data: rawEvents } = await supabase
        .from("message_events")
        .select("event_type, metadata")
        .eq("campaign_contact_id", item.id)
        .order("occurred_at", { ascending: true });
      const resolution = resolveWorkflowAdvance(
        workflowSteps,
        Number(item.current_step),
        (rawEvents as Array<{ event_type: string; metadata?: { stepNumber?: number | string | null } | null }> | null) ?? [],
      );

      if (resolution.action === "advance") {
        await supabase
          .from("campaign_contacts")
          .update({
            status: Number(resolution.nextStep.stepNumber) > 1 ? "followup_due" : "queued",
            current_step: Number(resolution.nextStep.stepNumber),
            current_node_key: String(resolution.nextStep.key ?? `step-${resolution.nextStep.stepNumber}`),
            branch_history_jsonb: [
              ...(((item.branch_history_jsonb as Array<Record<string, unknown>> | null | undefined) ?? [])),
              {
                fromStep: item.current_step,
                toStep: Number(resolution.nextStep.stepNumber),
                matched: Boolean(resolution.matched),
                reason: resolution.reason ?? null,
                resolvedAt: new Date().toISOString(),
              },
            ],
            next_due_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", item.id);
      } else {
        await supabase
          .from("campaign_contacts")
          .update({
            status: Number(item.current_step) > 1 ? "followup_sent" : "sent",
            current_node_key: null,
            exit_reason: resolution.exitReason ?? null,
            next_due_at: null,
            error_message: null,
          })
          .eq("id", item.id);
      }

      continue;
    }

    await supabase
      .from("campaign_contacts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("status", item.status);

    try {
      const accessToken = await resolveMailboxAccess(mailbox);
      const unsubscribeToken = crypto.randomUUID();
      const unsubscribeLink = `${Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000"}/api/unsubscribes/${unsubscribeToken}`;
      const renderedSubject = renderTemplate(String(step.subject ?? ""), contact);
      const renderedTextBody = renderTemplate(String(step.body ?? ""), contact);
      const renderedHtmlBody =
        String(step.mode ?? "text") === "html" && step.bodyHtml
          ? renderTemplate(String(step.bodyHtml ?? ""), contact)
          : `${renderedTextBody}<br /><br /><a href="${unsubscribeLink}">Unsubscribe</a>`;
      const trackedHtml = await instrumentHtmlForTracking({
        workspaceId: campaign.workspace_id,
        campaignContactId: item.id,
        stepNumber: item.current_step,
        html: renderedHtmlBody.includes("Unsubscribe")
          ? renderedHtmlBody
          : `${renderedHtmlBody}<br /><br /><a href="${unsubscribeLink}">Unsubscribe</a>`,
      });
      const nextStep = workflowSteps.find(
        (candidate) => Number(candidate.stepNumber) === Number(item.current_step) + 1,
      );
      const sendResult = await gmailSend({
        accessToken,
        fromEmail: mailbox.email_address,
        toEmail: contact.email,
        subject: renderedSubject,
        bodyHtml: trackedHtml,
        threadId: item.current_step > 1 ? item.last_thread_id : null,
      });

      const sentAt = new Date().toISOString();

      await supabase.from("outbound_messages").insert({
        campaign_contact_id: item.id,
        gmail_message_id: sendResult.id ?? null,
        gmail_thread_id: sendResult.threadId ?? null,
        step_number: item.current_step,
        sent_at: sentAt,
        status: "sent",
      });

      await supabase.from("message_threads").upsert({
        workspace_id: campaign.workspace_id,
        campaign_contact_id: item.id,
        gmail_thread_id: sendResult.threadId ?? sendResult.id ?? crypto.randomUUID(),
        subject: renderedSubject,
        snippet: renderedTextBody.slice(0, 120),
        latest_message_at: sentAt,
      });

      await supabase.from("unsubscribes").upsert({
        workspace_id: campaign.workspace_id,
        contact_id: item.contact_id,
        email: contact.email,
        token_hash: await hashToken(unsubscribeToken),
      });

      await supabase
        .from("campaign_contacts")
        .update({
          status: nextStep ? "sent" : item.current_step > 1 ? "followup_sent" : "sent",
          current_step: item.current_step,
          current_node_key: String(step.key ?? `step-${item.current_step}`),
          next_due_at: nextStep
            ? new Date(Date.now() + Number(step.waitDays ?? config.followUpDelayDays) * 24 * 60 * 60 * 1000).toISOString()
            : null,
          last_thread_id: sendResult.threadId ?? null,
          last_message_id: sendResult.id ?? null,
        })
        .eq("id", item.id);

      await supabase.from("message_events").insert({
        workspace_id: campaign.workspace_id,
        campaign_contact_id: item.id,
        gmail_message_id: sendResult.id ?? null,
        event_type: "sent",
        metadata: {
          stepNumber: item.current_step,
          subject: renderedSubject,
          toEmail: contact.email,
        },
      });
      await enqueueCrmWritebackJobs({
        supabase,
        workspaceId: campaign.workspace_id,
        campaignContactId: item.id,
        eventType: "sent",
        metadata: {
          stepNumber: item.current_step,
          subject: renderedSubject,
        },
      });

      workspaceSendState.dailyUsed += 1;
      workspaceSendState.monthlyUsed += 1;

      processed += 1;
    } catch (sendError) {
      await supabase
        .from("campaign_contacts")
        .update({
          status: "failed",
          failed_attempts: item.failed_attempts + 1,
          error_message: sendError instanceof Error ? sendError.message : "Unknown send error",
        })
        .eq("id", item.id);
    }
  }

  return json({ processed });
});
