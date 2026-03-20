import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { config } from "../shared/config.ts";
import { decryptToken, encryptToken } from "../shared/crypto.ts";
import { json } from "../shared/response.ts";

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);

function verifyCron(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  return config.cronVerifySecret ? secret === config.cronVerifySecret : true;
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function parseJsonResponse<T>(response: Response, label: string) {
  if (!response.ok) {
    throw new Error(`${label} failed: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

async function createSyncRun(workspaceId: string, connectionId: string, direction: "pull" | "push") {
  const { data } = await supabase
    .from("crm_sync_runs")
    .insert({
      workspace_id: workspaceId,
      crm_connection_id: connectionId,
      direction,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  return (data as { id?: string } | null)?.id ?? null;
}

async function finishSyncRun(runId: string | null, input: {
  status: "completed" | "failed";
  importedCount?: number;
  exportedCount?: number;
  errorMessage?: string | null;
}) {
  if (!runId) {
    return;
  }

  await supabase
    .from("crm_sync_runs")
    .update({
      status: input.status,
      imported_count: input.importedCount ?? 0,
      exported_count: input.exportedCount ?? 0,
      error_message: input.errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

async function getWorkspaceOwnerUserId(workspaceId: string) {
  const { data } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  const members = (data ?? []) as Array<{ user_id: string; role: string }>;
  return members.find((member) => member.role === "owner")?.user_id ?? members[0]?.user_id ?? null;
}

async function refreshHubSpot(connection: Record<string, unknown>) {
  const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.hubspotClientId,
      client_secret: config.hubspotClientSecret,
      refresh_token: await decryptToken(String(connection.refresh_token_encrypted ?? "")),
    }),
  });
  const token = await parseJsonResponse<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }>(response, "HubSpot token refresh");

  await supabase
    .from("crm_connections")
    .update({
      access_token_encrypted: await encryptToken(token.access_token),
      refresh_token_encrypted: token.refresh_token
        ? await encryptToken(token.refresh_token)
        : connection.refresh_token_encrypted ?? null,
      token_expiry: token.expires_in
        ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
        : null,
      last_error: null,
    })
    .eq("id", connection.id);

  return token.access_token;
}

async function refreshSalesforce(connection: Record<string, unknown>) {
  const response = await fetch(`${config.salesforceAuthBaseUrl}/services/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.salesforceClientId,
      client_secret: config.salesforceClientSecret,
      refresh_token: await decryptToken(String(connection.refresh_token_encrypted ?? "")),
    }),
  });
  const token = await parseJsonResponse<{
    access_token: string;
    instance_url?: string;
  }>(response, "Salesforce token refresh");

  const currentMetadata = (connection.connection_metadata_jsonb as Record<string, unknown> | null) ?? {};
  await supabase
    .from("crm_connections")
    .update({
      access_token_encrypted: await encryptToken(token.access_token),
      connection_metadata_jsonb: {
        ...currentMetadata,
        instanceUrl: token.instance_url ?? currentMetadata.instanceUrl ?? null,
      },
      last_error: null,
    })
    .eq("id", connection.id);

  return token.access_token;
}

async function resolveAccessToken(connection: Record<string, unknown>) {
  const encrypted = String(connection.access_token_encrypted ?? "");
  const expiry = connection.token_expiry ? new Date(String(connection.token_expiry)).getTime() : null;
  const refreshTokenEncrypted = connection.refresh_token_encrypted ? String(connection.refresh_token_encrypted) : null;

  if (encrypted && (!expiry || expiry > Date.now() + 60_000)) {
    return await decryptToken(encrypted);
  }

  if (!refreshTokenEncrypted) {
    throw new Error("CRM connection is missing a refresh token.");
  }

  if (connection.provider === "hubspot") {
    return await refreshHubSpot(connection);
  }

  if (connection.provider === "salesforce") {
    return await refreshSalesforce(connection);
  }

  return encrypted ? await decryptToken(encrypted) : "";
}

async function upsertContacts(input: {
  workspaceId: string;
  connectionId: string;
  provider: string;
  contacts: Array<{
    externalId: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null;
    website?: string | null;
    jobTitle?: string | null;
  }>;
}) {
  if (!input.contacts.length) {
    return 0;
  }

  const ownerUserId = await getWorkspaceOwnerUserId(input.workspaceId);

  if (!ownerUserId) {
    throw new Error("Workspace owner not found for CRM sync.");
  }

  await (supabase.from("contacts") as unknown as {
    upsert: (
      values: Array<Record<string, unknown>>,
      options: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(
    input.contacts.map((contact) => ({
      workspace_id: input.workspaceId,
      owner_user_id: ownerUserId,
      external_source: input.provider,
      external_contact_id: contact.externalId,
      email: contact.email,
      first_name: contact.firstName ?? null,
      last_name: contact.lastName ?? null,
      company: contact.company ?? null,
      website: contact.website ?? null,
      job_title: contact.jobTitle ?? null,
      custom_fields_jsonb: {},
      source: input.provider,
    })),
    {
      onConflict: "workspace_id,external_source,external_contact_id",
    },
  );

  const { data: localContacts } = await supabase
    .from("contacts")
    .select("id, external_contact_id")
    .eq("workspace_id", input.workspaceId)
    .eq("external_source", input.provider)
    .in("external_contact_id", input.contacts.map((contact) => contact.externalId));
  const contactMap = new Map(
    ((localContacts ?? []) as Array<{ id: string; external_contact_id: string | null }>).map((contact) => [
      contact.external_contact_id,
      contact.id,
    ]),
  );

  await (supabase.from("crm_object_links") as unknown as {
    upsert: (
      values: Array<Record<string, unknown>>,
      options?: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(
    input.contacts
      .map((contact) => ({
        workspace_id: input.workspaceId,
        crm_connection_id: input.connectionId,
        object_type: "contact",
        external_object_id: contact.externalId,
        local_object_type: "contact",
        local_object_id: contactMap.get(contact.externalId),
        metadata: {
          email: contact.email,
        },
      }))
      .filter((contact) => Boolean(contact.local_object_id)),
    { onConflict: "crm_connection_id,object_type,external_object_id" },
  );

  return input.contacts.length;
}

async function syncHubSpotConnection(connection: Record<string, unknown>) {
  const accessToken = await resolveAccessToken(connection);
  const after = String((connection.sync_cursor_jsonb as Record<string, unknown> | null)?.after ?? "");
  const url = new URL("https://api.hubapi.com/crm/v3/objects/contacts");
  url.searchParams.set("limit", "100");
  url.searchParams.set("properties", "firstname,lastname,email,jobtitle,website,company");
  if (after) {
    url.searchParams.set("after", after);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = await parseJsonResponse<{
    results?: Array<{ id: string; properties?: Record<string, string | null> }>;
    paging?: { next?: { after?: string | null } | null } | null;
  }>(response, "HubSpot contact sync");

  const contacts = (payload.results ?? [])
    .map((contact) => ({
      externalId: contact.id,
      email: String(contact.properties?.email ?? "").trim(),
      firstName: contact.properties?.firstname ?? null,
      lastName: contact.properties?.lastname ?? null,
      company: contact.properties?.company ?? null,
      website: contact.properties?.website ?? null,
      jobTitle: contact.properties?.jobtitle ?? null,
    }))
    .filter((contact) => Boolean(contact.email));

  const imported = await upsertContacts({
    workspaceId: String(connection.workspace_id),
    connectionId: String(connection.id),
    provider: "hubspot",
    contacts,
  });

  await supabase
    .from("crm_connections")
    .update({
      status: "connected",
      sync_cursor_jsonb: payload.paging?.next?.after ? { after: payload.paging.next.after } : {},
      last_synced_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", connection.id);

  return imported;
}

async function syncSalesforceConnection(connection: Record<string, unknown>) {
  const accessToken = await resolveAccessToken(connection);
  const metadata = (connection.connection_metadata_jsonb as Record<string, unknown> | null) ?? {};
  const instanceUrl = String(metadata.instanceUrl ?? "");

  if (!instanceUrl) {
    throw new Error("Salesforce connection is missing an instance URL.");
  }

  const nextRecordsUrl = String((connection.sync_cursor_jsonb as Record<string, unknown> | null)?.nextRecordsUrl ?? "");
  const queryPath =
    nextRecordsUrl ||
    `/services/data/v60.0/query?q=${encodeURIComponent(
      "SELECT Id, FirstName, LastName, Email, Title, Account.Name, Account.Website FROM Contact WHERE Email != null ORDER BY LastModifiedDate DESC LIMIT 200",
    )}`;
  const response = await fetch(`${instanceUrl}${queryPath}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = await parseJsonResponse<{
    records?: Array<{
      Id: string;
      FirstName?: string | null;
      LastName?: string | null;
      Email?: string | null;
      Title?: string | null;
      Account?: { Name?: string | null; Website?: string | null } | null;
    }>;
    nextRecordsUrl?: string | null;
  }>(response, "Salesforce contact sync");

  const contacts = (payload.records ?? [])
    .map((contact) => ({
      externalId: contact.Id,
      email: String(contact.Email ?? "").trim(),
      firstName: contact.FirstName ?? null,
      lastName: contact.LastName ?? null,
      company: contact.Account?.Name ?? null,
      website: contact.Account?.Website ?? null,
      jobTitle: contact.Title ?? null,
    }))
    .filter((contact) => Boolean(contact.email));

  const imported = await upsertContacts({
    workspaceId: String(connection.workspace_id),
    connectionId: String(connection.id),
    provider: "salesforce",
    contacts,
  });

  await supabase
    .from("crm_connections")
    .update({
      status: "connected",
      sync_cursor_jsonb: payload.nextRecordsUrl ? { nextRecordsUrl: payload.nextRecordsUrl } : {},
      last_synced_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", connection.id);

  return imported;
}

async function writebackJob(connection: Record<string, unknown>, job: Record<string, unknown>) {
  const payload = (job.payload_jsonb as Record<string, unknown> | null) ?? {};
  const summary = String(payload.summary ?? "OutboundFlow activity");

  if (connection.provider === "custom_crm") {
    const webhookUrl = String(connection.outbound_webhook_url ?? "");

    if (!webhookUrl) {
      return;
    }

    const body = JSON.stringify({
      type: String(payload.eventType ?? "activity"),
      summary,
      contact: {
        externalContactId: payload.externalContactId ?? null,
        email: payload.email ?? null,
      },
      metadata: payload.metadata ?? {},
    });
    const secret = connection.webhook_signing_secret_encrypted
      ? await decryptToken(String(connection.webhook_signing_secret_encrypted))
      : "";
    const signature = secret
      ? toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}.${body}`)))
      : null;

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "x-outboundflow-signature": signature } : {}),
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Custom CRM writeback failed: ${await response.text()}`);
    }

    return;
  }

  if (!payload.externalContactId) {
    return;
  }

  const accessToken = await resolveAccessToken(connection);

  if (connection.provider === "hubspot") {
    await parseJsonResponse(
      await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            hs_note_body: summary,
            hs_timestamp: Date.now(),
          },
          associations: [
            {
              to: { id: String(payload.externalContactId) },
              types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
            },
          ],
        }),
      }),
      "HubSpot note writeback",
    );
    return;
  }

  const metadata = (connection.connection_metadata_jsonb as Record<string, unknown> | null) ?? {};
  const instanceUrl = String(metadata.instanceUrl ?? "");

  if (!instanceUrl) {
    throw new Error("Salesforce connection is missing an instance URL.");
  }

  await parseJsonResponse(
    await fetch(`${instanceUrl}/services/data/v60.0/sobjects/Task`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Subject: "OutboundFlow activity",
        Description: summary,
        Status: "Completed",
        Priority: "Normal",
        WhoId: String(payload.externalContactId),
      }),
    }),
    "Salesforce task writeback",
  );
}

async function runPullSync(connection: Record<string, unknown>) {
  if (connection.provider === "custom_crm") {
    return 0;
  }

  const runId = await createSyncRun(String(connection.workspace_id), String(connection.id), "pull");

  try {
    const imported =
      connection.provider === "hubspot"
        ? await syncHubSpotConnection(connection)
        : await syncSalesforceConnection(connection);
    await finishSyncRun(runId, {
      status: "completed",
      importedCount: imported,
    });
    return imported;
  } catch (error) {
    const message = error instanceof Error ? error.message : "CRM pull sync failed";
    await supabase
      .from("crm_connections")
      .update({
        status: "error",
        last_error: message,
      })
      .eq("id", connection.id);
    await finishSyncRun(runId, {
      status: "failed",
      errorMessage: message,
    });
    return 0;
  }
}

async function processPushJobs() {
  const { data: jobs } = await supabase
    .from("crm_push_jobs")
    .select("id, workspace_id, crm_connection_id, attempts, max_attempts, payload_jsonb")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(50);

  let processed = 0;

  for (const job of (jobs ?? []) as Array<Record<string, unknown>>) {
    const { data: connection } = await supabase
      .from("crm_connections")
      .select("*")
      .eq("id", job.crm_connection_id)
      .maybeSingle();

    if (!connection) {
      continue;
    }

    const runId = await createSyncRun(String(job.workspace_id), String(job.crm_connection_id), "push");

    try {
      await supabase
        .from("crm_push_jobs")
        .update({
          status: "running",
          attempts: Number(job.attempts ?? 0) + 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      await writebackJob(connection as Record<string, unknown>, job);

      await supabase
        .from("crm_push_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      await supabase
        .from("crm_connections")
        .update({
          status: "connected",
          last_writeback_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", job.crm_connection_id);
      await finishSyncRun(runId, {
        status: "completed",
        exportedCount: 1,
      });
      processed += 1;
    } catch (error) {
      const attempts = Number(job.attempts ?? 0) + 1;
      const message = error instanceof Error ? error.message : "CRM push writeback failed";
      await supabase
        .from("crm_push_jobs")
        .update({
          status: attempts >= Number(job.max_attempts ?? 5) ? "failed" : "pending",
          error_message: message,
          next_attempt_at: new Date(Date.now() + Math.min(attempts, 5) * 60 * 1000).toISOString(),
        })
        .eq("id", job.id);
      await supabase
        .from("crm_connections")
        .update({
          last_error: message,
        })
        .eq("id", job.crm_connection_id);
      await finishSyncRun(runId, {
        status: "failed",
        errorMessage: message,
      });
    }
  }

  return processed;
}

Deno.serve(async (request) => {
  if (!verifyCron(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: connections, error } = await supabase
    .from("crm_connections")
    .select("*")
    .in("status", ["active", "connected", "error"]);

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  let imported = 0;

  for (const connection of (connections ?? []) as Array<Record<string, unknown>>) {
    const frequencyMinutes = Number(connection.sync_frequency_minutes ?? 30);
    const lastSyncedAt = connection.last_synced_at ? new Date(String(connection.last_synced_at)).getTime() : 0;

    if (Date.now() - lastSyncedAt < frequencyMinutes * 60 * 1000) {
      continue;
    }

    imported += await runPullSync(connection);
  }

  const processed = await processPushJobs();

  return json({ imported, processed });
});
