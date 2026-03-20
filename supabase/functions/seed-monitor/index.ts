import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { config } from "../shared/config.ts";
import { decryptToken, encryptToken } from "../shared/crypto.ts";
import { gmailGetMessage, gmailListMessages, gmailRefreshAccessToken, gmailSend } from "../shared/gmail.ts";
import { json } from "../shared/response.ts";

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);

function verifyCron(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  return config.cronVerifySecret ? secret === config.cronVerifySecret : true;
}

async function resolveOauthAccess(input: {
  connectionId: string;
  accessTokenEncrypted?: string | null;
  refreshTokenEncrypted?: string | null;
  tokenExpiry?: string | null;
}) {
  const shouldRefresh =
    !input.accessTokenEncrypted ||
    (input.tokenExpiry && new Date(input.tokenExpiry).getTime() <= Date.now() + 60_000);

  if (!shouldRefresh && input.accessTokenEncrypted) {
    return await decryptToken(input.accessTokenEncrypted);
  }

  if (!input.refreshTokenEncrypted) {
    throw new Error("Seed monitor connection is missing a refresh token.");
  }

  const refreshed = await gmailRefreshAccessToken(await decryptToken(input.refreshTokenEncrypted));

  await supabase
    .from("oauth_connections")
    .update({
      access_token_encrypted: await encryptToken(refreshed.access_token),
      token_expiry: refreshed.expires_in
        ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString()
        : null,
    })
    .eq("id", input.connectionId);

  return refreshed.access_token as string;
}

function classifyPlacement(labelIds: string[] | null | undefined) {
  const labels = new Set(labelIds ?? []);

  if (labels.has("SPAM")) {
    return "spam";
  }

  if (labels.has("TRASH")) {
    return "junk";
  }

  if (labels.has("CATEGORY_PROMOTIONS")) {
    return "promotions";
  }

  if (labels.has("CATEGORY_UPDATES")) {
    return "updates";
  }

  if (labels.has("CATEGORY_PERSONAL") || labels.has("INBOX")) {
    return "primary";
  }

  return "missing";
}

async function insertSeedResult(input: {
  workspaceId: string;
  seedInboxId: string;
  senderGmailAccountId: string;
  probeKey: string;
  probeSubject: string;
  gmailMessageId?: string | null;
  placementStatus: string;
}) {
  await supabase.from("seed_inbox_results").insert({
    workspace_id: input.workspaceId,
    seed_inbox_id: input.seedInboxId,
    sender_gmail_account_id: input.senderGmailAccountId,
    probe_key: input.probeKey,
    provider: "gmail",
    probe_subject: input.probeSubject,
    gmail_message_id: input.gmailMessageId ?? null,
    placement_status: input.placementStatus,
  });

  await supabase
    .from("seed_inboxes")
    .update({
      last_checked_at: new Date().toISOString(),
      last_result_status: input.placementStatus,
      health_status: input.placementStatus === "spam" || input.placementStatus === "junk" ? "warning" : "healthy",
      last_error: null,
    })
    .eq("id", input.seedInboxId);
}

Deno.serve(async (request) => {
  if (!verifyCron(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: pendingJobs, error } = await supabase
    .from("seed_probe_jobs")
    .select(`
      id,
      workspace_id,
      seed_inbox_id,
      sender_gmail_account_id,
      probe_key,
      subject,
      status,
      sent_at,
      payload_jsonb,
      seed_inbox:seed_inboxes(
        id,
        email_address,
        oauth_connection_id
      ),
      sender:gmail_accounts(
        id,
        email_address,
        approval_status,
        status,
        oauth_connection:oauth_connections(
          id,
          access_token_encrypted,
          refresh_token_encrypted,
          token_expiry
        )
      )
    `)
    .in("status", ["pending", "sent"])
    .order("created_at", { ascending: true })
    .limit(60);

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let observed = 0;

  for (const job of (pendingJobs ?? []) as Array<Record<string, unknown>>) {
    const payload = (job.payload_jsonb as Record<string, unknown> | null) ?? {};
    const seedInbox = job.seed_inbox as {
      id: string;
      email_address: string;
      oauth_connection_id?: string | null;
    } | null;
    const sender = job.sender as {
      id: string;
      email_address: string;
      approval_status?: string | null;
      status?: string | null;
      oauth_connection?: {
        id: string;
        access_token_encrypted?: string | null;
        refresh_token_encrypted?: string | null;
        token_expiry?: string | null;
      } | null;
    } | null;

    if (!seedInbox || !sender || !sender.oauth_connection) {
      continue;
    }

    if (job.status === "pending") {
      if (sender.approval_status && sender.approval_status !== "approved") {
        continue;
      }

      const senderAccessToken = await resolveOauthAccess({
        connectionId: sender.oauth_connection.id,
        accessTokenEncrypted: sender.oauth_connection.access_token_encrypted,
        refreshTokenEncrypted: sender.oauth_connection.refresh_token_encrypted,
        tokenExpiry: sender.oauth_connection.token_expiry,
      });

      const sendResult = await gmailSend({
        accessToken: senderAccessToken,
        fromEmail: sender.email_address,
        toEmail: String(payload.recipientEmail ?? seedInbox.email_address),
        subject: String(job.subject),
        bodyHtml: `<p>OutboundFlow placement probe ${String(job.probe_key)}</p>`,
      });

      await supabase
        .from("seed_probe_jobs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          payload_jsonb: {
            ...payload,
            gmailMessageId: sendResult.id ?? null,
          },
        })
        .eq("id", job.id);
      await supabase
        .from("seed_inboxes")
        .update({
          last_probe_at: new Date().toISOString(),
          last_error: null,
          connection_status: "connected",
        })
        .eq("id", seedInbox.id);
      sent += 1;
      continue;
    }

    const { data: seedOauth } = await supabase
      .from("oauth_connections")
      .select("id, access_token_encrypted, refresh_token_encrypted, token_expiry")
      .eq("id", seedInbox.oauth_connection_id ?? "")
      .maybeSingle();

    if (!seedOauth) {
      continue;
    }

    const seedAccessToken = await resolveOauthAccess({
      connectionId: String(seedOauth.id),
      accessTokenEncrypted: seedOauth.access_token_encrypted,
      refreshTokenEncrypted: seedOauth.refresh_token_encrypted,
      tokenExpiry: seedOauth.token_expiry,
    });
    const subject = String(job.subject ?? "");
    const searchResult = await gmailListMessages(seedAccessToken, `subject:"${subject}" newer_than:2d`, 5);
    const matchedMessageId = (searchResult.messages?.[0]?.id as string | undefined) ?? null;

    if (matchedMessageId) {
      const message = await gmailGetMessage(seedAccessToken, matchedMessageId);
      const placementStatus = classifyPlacement((message.labelIds as string[] | undefined) ?? []);
      await insertSeedResult({
        workspaceId: String(job.workspace_id),
        seedInboxId: seedInbox.id,
        senderGmailAccountId: String(job.sender_gmail_account_id),
        probeKey: String(job.probe_key),
        probeSubject: subject,
        gmailMessageId: matchedMessageId,
        placementStatus,
      });
      await supabase
        .from("seed_probe_jobs")
        .update({
          status: "observed",
          observed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", job.id);
      observed += 1;
      continue;
    }

    const sentAt = job.sent_at ? new Date(String(job.sent_at)).getTime() : 0;

    if (sentAt && Date.now() - sentAt > Math.max(config.seedMonitorIntervalMinutes, 20) * 60 * 1000) {
      await insertSeedResult({
        workspaceId: String(job.workspace_id),
        seedInboxId: seedInbox.id,
        senderGmailAccountId: String(job.sender_gmail_account_id),
        probeKey: String(job.probe_key),
        probeSubject: subject,
        placementStatus: "missing",
      });
      await supabase
        .from("seed_probe_jobs")
        .update({
          status: "failed",
          observed_at: new Date().toISOString(),
          last_error: "Probe not observed in time window.",
        })
        .eq("id", job.id);
    }
  }

  return json({ sent, observed });
});
