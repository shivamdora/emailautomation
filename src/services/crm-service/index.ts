import "server-only";
import { randomBytes } from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashToken, encryptToken } from "@/lib/crypto/tokens";
import { requireSupabaseConfiguration } from "@/lib/supabase/env";
import { isAnyMissingColumnResult, isMissingTableResult } from "@/lib/utils/supabase-schema";
import {
  getCRMAdapter,
  getEncryptedTokenValue,
  type CrmConnectionRecord,
  type CrmOAuthExchangeResult,
  type CrmProvider,
  type CrmPullSyncResult,
} from "@/services/crm-adapters";
import {
  assertWorkspaceCanCreateCrmConnection,
  refreshWorkspaceUsageCounters,
} from "@/services/entitlement-service";
import { emitWorkspaceIntegrationEvent } from "@/services/integration-event-service";

function createSecret(prefix: string) {
  return `${prefix}_${randomBytes(20).toString("hex")}`;
}

function getSyncRunSupabase() {
  return createAdminSupabaseClient();
}

async function getWorkspaceOwnerUserId(workspaceId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const members = (data ?? []) as Array<{
    user_id: string;
    role: "owner" | "admin" | "member";
    created_at: string;
  }>;

  return members.find((member) => member.role === "owner")?.user_id ?? members[0]?.user_id ?? null;
}

async function createSyncRun(input: {
  workspaceId: string;
  crmConnectionId: string;
  direction: "pull" | "push";
}) {
  const supabase = getSyncRunSupabase();
  const { data, error } = await supabase
    .from("crm_sync_runs")
    .insert({
      workspace_id: input.workspaceId,
      crm_connection_id: input.crmConnectionId,
      direction: input.direction,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTableResult({ error, data: null, status: 400 }, "crm_sync_runs")) {
      return null;
    }

    throw error;
  }

  return (data as { id: string }).id;
}

async function completeSyncRun(input: {
  runId: string | null;
  status: "completed" | "failed";
  importedCount?: number;
  exportedCount?: number;
  errorMessage?: string | null;
}) {
  if (!input.runId) {
    return;
  }

  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("crm_sync_runs")
    .update({
      status: input.status,
      imported_count: input.importedCount ?? 0,
      exported_count: input.exportedCount ?? 0,
      error_message: input.errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.runId);

  if (result.error && !isMissingTableResult(result, "crm_sync_runs")) {
    throw result.error;
  }
}

async function getCrmConnectionById(connectionId: string) {
  const supabase = createAdminSupabaseClient();
  let result = await supabase
    .from("crm_connections")
    .select(
      "id, workspace_id, provider, status, auth_type, provider_account_id, provider_account_label, provider_account_email, access_token_encrypted, refresh_token_encrypted, token_expiry, inbound_api_key_hash, inbound_api_key_hint, outbound_webhook_url, webhook_signing_secret_encrypted, sync_cursor_jsonb, field_mapping_jsonb, connection_metadata_jsonb",
    )
    .eq("id", connectionId)
    .maybeSingle();

  if (
    isAnyMissingColumnResult(result, [
      { table: "crm_connections", column: "auth_type" },
      { table: "crm_connections", column: "provider_account_label" },
      { table: "crm_connections", column: "provider_account_email" },
      { table: "crm_connections", column: "connection_metadata_jsonb" },
    ])
  ) {
    result = await supabase
      .from("crm_connections")
      .select("id, workspace_id, provider, status, config_jsonb")
      .eq("id", connectionId)
      .maybeSingle();
  }

  if (result.error) {
    throw result.error;
  }

  const connection = result.data as
    | (CrmConnectionRecord & {
        config_jsonb?: Record<string, unknown> | null;
      })
    | null;

  if (!connection) {
    throw new Error("CRM connection not found.");
  }

  return {
    ...connection,
    auth_type: connection.auth_type ?? "api_key",
    sync_cursor_jsonb: connection.sync_cursor_jsonb ?? connection.config_jsonb ?? {},
    field_mapping_jsonb: connection.field_mapping_jsonb ?? {},
    connection_metadata_jsonb: connection.connection_metadata_jsonb ?? connection.config_jsonb ?? {},
  } as CrmConnectionRecord;
}

async function updateCrmConnection(connectionId: string, values: Record<string, unknown>) {
  const supabase = createAdminSupabaseClient();
  const result = await supabase.from("crm_connections").update(values).eq("id", connectionId);

  if (result.error) {
    throw result.error;
  }
}

async function upsertContactsFromPull(input: {
  workspaceId: string;
  crmConnectionId: string;
  provider: CrmProvider;
  contacts: CrmPullSyncResult["contacts"];
}) {
  if (!input.contacts.length) {
    return { imported: 0 };
  }

  const supabase = createAdminSupabaseClient();
  const ownerUserId = await getWorkspaceOwnerUserId(input.workspaceId);

  if (!ownerUserId) {
    throw new Error("Could not resolve a workspace owner for CRM sync.");
  }

  const contactsTable = supabase.from("contacts") as unknown as {
    upsert: (
      values: Array<Record<string, unknown>>,
      options: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await contactsTable.upsert(
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
      custom_fields_jsonb: contact.customFields ?? {},
      source: input.provider,
    })),
    {
      onConflict: "workspace_id,external_source,external_contact_id",
    },
  );

  if (error) {
    throw error;
  }

  const { data: localContacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id, external_contact_id")
    .eq("workspace_id", input.workspaceId)
    .eq("external_source", input.provider)
    .in("external_contact_id", input.contacts.map((contact) => contact.externalId));

  if (contactsError) {
    throw contactsError;
  }

  const localContactsByExternalId = new Map(
    ((localContacts ?? []) as Array<{ id: string; external_contact_id: string | null }>).map((contact) => [
      contact.external_contact_id,
      contact.id,
    ]),
  );

  const linkResult = await (
    supabase.from("crm_object_links") as unknown as {
      upsert: (
        values: Array<Record<string, unknown>>,
        options?: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert(
    input.contacts
      .map((contact) => ({
        workspace_id: input.workspaceId,
        crm_connection_id: input.crmConnectionId,
        object_type: "contact",
        external_object_id: contact.externalId,
        local_object_type: "contact",
        local_object_id: localContactsByExternalId.get(contact.externalId),
        metadata: {
          email: contact.email,
        },
      }))
      .filter((link) => Boolean(link.local_object_id)),
    { onConflict: "crm_connection_id,object_type,external_object_id" },
  );

  if (linkResult.error && !isMissingTableResult(linkResult, "crm_object_links")) {
    throw linkResult.error;
  }

  return { imported: input.contacts.length };
}

function buildWritebackSummary(eventType: string, metadata?: Record<string, unknown>) {
  const details = [
    `OutboundFlow recorded a ${eventType} event.`,
    metadata?.campaignName ? `Campaign: ${metadata.campaignName}` : null,
    metadata?.subject ? `Subject: ${metadata.subject}` : null,
    metadata?.replyDisposition ? `Reply disposition: ${metadata.replyDisposition}` : null,
  ].filter(Boolean);

  return details.join(" ");
}

async function resolveLocalContactForWriteback(input: {
  workspaceId: string;
  campaignContactId?: string | null;
  contactId?: string | null;
}) {
  const supabase = createAdminSupabaseClient();

  if (input.contactId) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, email")
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.contactId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as { id: string; email: string } | null;
  }

  if (!input.campaignContactId) {
    return null;
  }

  const { data, error } = await supabase
    .from("campaign_contacts")
    .select("contact:contacts(id, email)")
    .eq("id", input.campaignContactId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return ((data as { contact?: { id: string; email: string } | null } | null)?.contact ?? null) as {
    id: string;
    email: string;
  } | null;
}

export async function listWorkspaceCrmConnections(workspaceId: string) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  let result = await supabase
    .from("crm_connections")
    .select(
      "id, provider, status, auth_type, provider_account_label, provider_account_email, inbound_api_key_hint, outbound_webhook_url, last_synced_at, last_writeback_at, last_error",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (
    isAnyMissingColumnResult(result, [
      { table: "crm_connections", column: "auth_type" },
      { table: "crm_connections", column: "provider_account_label" },
      { table: "crm_connections", column: "provider_account_email" },
      { table: "crm_connections", column: "inbound_api_key_hint" },
      { table: "crm_connections", column: "last_synced_at" },
      { table: "crm_connections", column: "last_writeback_at" },
      { table: "crm_connections", column: "last_error" },
    ])
  ) {
    result = await supabase
      .from("crm_connections")
      .select("id, provider, status")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
  }

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []) as Array<Record<string, unknown>>;
}

export async function createCustomCrmConnection(input: {
  workspaceId: string;
  actorUserId: string;
  providerAccountLabel: string;
  outboundWebhookUrl?: string | null;
}) {
  requireSupabaseConfiguration();
  await assertWorkspaceCanCreateCrmConnection(input.workspaceId);

  const supabase = createAdminSupabaseClient();
  const inboundApiKey = createSecret("ofcrm");
  const webhookSigningSecret = createSecret("ofcrmwh");
  const payload = {
    workspace_id: input.workspaceId,
    provider: "custom_crm",
    status: "active",
    auth_type: "api_key",
    provider_account_label: input.providerAccountLabel.trim() || "Custom CRM",
    provider_account_email: null,
    inbound_api_key_hash: hashToken(inboundApiKey),
    inbound_api_key_hint: inboundApiKey.slice(-6),
    inbound_api_key_last_rotated_at: new Date().toISOString(),
    outbound_webhook_url: input.outboundWebhookUrl?.trim() || null,
    webhook_signing_secret_encrypted: encryptToken(webhookSigningSecret),
    connection_metadata_jsonb: {
      managedBy: input.actorUserId,
    },
    sync_cursor_jsonb: {},
    field_mapping_jsonb: {},
  };

  const { data, error } = await (
    supabase.from("crm_connections") as unknown as {
      insert: (value: Record<string, unknown>) => {
        select: (columns: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
      };
    }
  )
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await refreshWorkspaceUsageCounters(input.workspaceId);

  return {
    connectionId: (data as { id: string }).id,
    inboundApiKey,
    webhookSigningSecret,
  };
}

export async function rotateCustomCrmApiKey(input: {
  workspaceId: string;
  connectionId: string;
}) {
  requireSupabaseConfiguration();
  const nextApiKey = createSecret("ofcrm");
  await updateCrmConnection(input.connectionId, {
    inbound_api_key_hash: hashToken(nextApiKey),
    inbound_api_key_hint: nextApiKey.slice(-6),
    inbound_api_key_last_rotated_at: new Date().toISOString(),
  });

  return {
    inboundApiKey: nextApiKey,
  };
}

export async function updateCustomCrmWebhook(input: {
  workspaceId: string;
  connectionId: string;
  outboundWebhookUrl?: string | null;
}) {
  requireSupabaseConfiguration();
  await updateCrmConnection(input.connectionId, {
    outbound_webhook_url: input.outboundWebhookUrl?.trim() || null,
  });
}

export async function resolveCustomCrmConnectionByApiKey(workspaceId: string, token: string) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("crm_connections")
    .select("id, workspace_id, provider, status, provider_account_label, inbound_api_key_hash")
    .eq("workspace_id", workspaceId)
    .eq("provider", "custom_crm")
    .eq("status", "active")
    .eq("inbound_api_key_hash", hashToken(token))
    .maybeSingle();

  if (
    isAnyMissingColumnResult(result, [
      { table: "crm_connections", column: "provider_account_label" },
      { table: "crm_connections", column: "inbound_api_key_hash" },
    ])
  ) {
    return null;
  }

  if (result.error) {
    throw result.error;
  }

  return result.data as
    | {
        id: string;
        workspace_id: string;
        provider: string;
        status: string;
        provider_account_label?: string | null;
        inbound_api_key_hash?: string | null;
      }
    | null;
}

export async function storeOAuthCrmConnection(input: {
  workspaceId: string;
  actorUserId: string;
  provider: Exclude<CrmProvider, "custom_crm">;
  exchange: CrmOAuthExchangeResult;
}) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const existing = await supabase
    .from("crm_connections")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("provider", input.provider)
    .eq("provider_account_id", input.exchange.providerAccountId ?? "")
    .maybeSingle();

  const payload = {
    workspace_id: input.workspaceId,
    provider: input.provider,
    status: "connected",
    auth_type: "oauth",
    provider_account_id: input.exchange.providerAccountId ?? null,
    provider_account_label: input.exchange.providerAccountLabel ?? input.provider,
    provider_account_email: input.exchange.providerAccountEmail ?? null,
    access_token_encrypted: getEncryptedTokenValue(input.exchange.accessToken),
    refresh_token_encrypted: getEncryptedTokenValue(input.exchange.refreshToken ?? null),
    token_expiry: input.exchange.tokenExpiry ?? null,
    connection_metadata_jsonb: {
      ...(input.exchange.connectionMetadata ?? {}),
      managedBy: input.actorUserId,
    },
    last_error: null,
  };

  if ((existing.data as { id?: string } | null)?.id) {
    await updateCrmConnection((existing.data as { id: string }).id, payload);
    await refreshWorkspaceUsageCounters(input.workspaceId);
    return { id: (existing.data as { id: string }).id };
  }

  await assertWorkspaceCanCreateCrmConnection(input.workspaceId);

  const { data, error } = await (
    supabase.from("crm_connections") as unknown as {
      insert: (value: Record<string, unknown>) => {
        select: (columns: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
      };
    }
  )
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await refreshWorkspaceUsageCounters(input.workspaceId);

  return data as { id: string };
}

export async function disconnectCrmConnection(workspaceId: string, connectionId: string) {
  requireSupabaseConfiguration();
  await updateCrmConnection(connectionId, {
    status: "disconnected",
    access_token_encrypted: null,
    refresh_token_encrypted: null,
    token_expiry: null,
  });
  await refreshWorkspaceUsageCounters(workspaceId);
}

export async function refreshCrmConnectionToken(connectionId: string) {
  const connection = await getCrmConnectionById(connectionId);
  const adapter = getCRMAdapter(connection.provider);

  if (!adapter.refreshToken) {
    return connection;
  }

  const refreshed = await adapter.refreshToken(connection);
  await updateCrmConnection(connectionId, {
    access_token_encrypted: getEncryptedTokenValue(refreshed.accessToken),
    refresh_token_encrypted: getEncryptedTokenValue(refreshed.refreshToken ?? connection.refresh_token_encrypted ?? null),
    token_expiry: refreshed.tokenExpiry ?? null,
    connection_metadata_jsonb: {
      ...(connection.connection_metadata_jsonb ?? {}),
      ...(refreshed.connectionMetadata ?? {}),
    },
    last_error: null,
  });

  return getCrmConnectionById(connectionId);
}

async function maybeRefreshConnection(connection: CrmConnectionRecord) {
  const expiry = connection.token_expiry ? new Date(connection.token_expiry).getTime() : null;

  if (connection.auth_type !== "oauth" || !expiry || expiry > Date.now() + 60_000) {
    return connection;
  }

  return refreshCrmConnectionToken(connection.id);
}

export async function syncCrmConnection(connectionId: string) {
  requireSupabaseConfiguration();
  const connection = await maybeRefreshConnection(await getCrmConnectionById(connectionId));
  const adapter = getCRMAdapter(connection.provider);
  const runId = await createSyncRun({
    workspaceId: connection.workspace_id,
    crmConnectionId: connection.id,
    direction: "pull",
  });

  try {
    const result = await adapter.pullSync(connection);
    const imported = await upsertContactsFromPull({
      workspaceId: connection.workspace_id,
      crmConnectionId: connection.id,
      provider: connection.provider,
      contacts: result.contacts,
    });

    await updateCrmConnection(connection.id, {
      status: "connected",
      sync_cursor_jsonb: result.nextCursor ?? {},
      provider_account_id: result.providerAccountId ?? connection.provider_account_id ?? null,
      provider_account_label: result.providerAccountLabel ?? connection.provider_account_label ?? connection.provider,
      provider_account_email: result.providerAccountEmail ?? connection.provider_account_email ?? null,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    });
    await completeSyncRun({
      runId,
      status: "completed",
      importedCount: imported.imported,
    });

    return {
      imported: imported.imported,
      provider: connection.provider,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CRM sync failure";
    await updateCrmConnection(connection.id, {
      status: "error",
      last_error: message,
    });
    await completeSyncRun({
      runId,
      status: "failed",
      errorMessage: message,
    });
    try {
      await emitWorkspaceIntegrationEvent({
        workspaceId: connection.workspace_id,
        eventType: "crm.sync_failed",
        summary: `${connection.provider_account_label ?? connection.provider} sync failed.`,
        metadata: {
          provider: connection.provider,
          error: message,
        },
      });
    } catch (integrationError) {
      console.error("Failed to emit CRM sync failure event", integrationError);
    }
    throw error;
  }
}

export async function syncWorkspaceCrmConnections(workspaceId: string) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("crm_connections")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "connected", "syncing", "error"]);

  if (error) {
    throw error;
  }

  const results = [];

  for (const connection of ((data ?? []) as Array<{ id: string }>)) {
    results.push(await syncCrmConnection(connection.id));
  }

  return results;
}

export async function enqueueCrmWritebackFromEvent(input: {
  workspaceId: string;
  campaignContactId?: string | null;
  contactId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown> | null;
}) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const localContact = await resolveLocalContactForWriteback({
    workspaceId: input.workspaceId,
    campaignContactId: input.campaignContactId,
    contactId: input.contactId,
  });

  if (!localContact) {
    return;
  }

  const { data: connections, error } = await supabase
    .from("crm_connections")
    .select("id, provider")
    .eq("workspace_id", input.workspaceId)
    .in("status", ["active", "connected"]);

  if (error) {
    if (isMissingTableResult({ error, data: null, status: 400 }, "crm_connections")) {
      return;
    }

    throw error;
  }

  const connectionIds = ((connections ?? []) as Array<{ id: string; provider: CrmProvider }>).map(
    (connection) => connection.id,
  );

  if (!connectionIds.length) {
    return;
  }

  const { data: objectLinks, error: linksError } = await supabase
    .from("crm_object_links")
    .select("crm_connection_id, external_object_id")
    .eq("workspace_id", input.workspaceId)
    .eq("local_object_type", "contact")
    .eq("local_object_id", localContact.id)
    .in("crm_connection_id", connectionIds);

  if (linksError && !isMissingTableResult({ error: linksError, data: null, status: 400 }, "crm_object_links")) {
    throw linksError;
  }

  const linkByConnectionId = new Map(
    ((objectLinks ?? []) as Array<{ crm_connection_id: string; external_object_id: string }>).map((link) => [
      link.crm_connection_id,
      link.external_object_id,
    ]),
  );

  const result = await (
    supabase.from("crm_push_jobs") as unknown as {
      insert: (
        values: Array<Record<string, unknown>>,
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).insert(
    connectionIds.map((connectionId) => ({
      workspace_id: input.workspaceId,
      crm_connection_id: connectionId,
      job_type: "activity_writeback",
      status: "pending",
      payload_jsonb: {
        externalContactId: linkByConnectionId.get(connectionId) ?? null,
        email: localContact.email,
        eventType: input.eventType,
        summary: buildWritebackSummary(input.eventType, input.metadata ?? undefined),
        metadata: input.metadata ?? {},
      },
    })),
  );

  if (result.error && !isMissingTableResult(result, "crm_push_jobs")) {
    throw result.error;
  }
}

export async function processCrmPushJobs(workspaceId?: string) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("crm_push_jobs")
    .select("id, workspace_id, crm_connection_id, job_type, attempts, max_attempts, payload_jsonb")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(50);

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingTableResult({ error, data: null, status: 400 }, "crm_push_jobs")) {
      return { processed: 0 };
    }

    throw error;
  }

  let processed = 0;

  for (const job of ((data ?? []) as Array<{
    id: string;
    workspace_id: string;
    crm_connection_id: string;
    job_type: string;
    attempts: number;
    max_attempts: number;
    payload_jsonb: Record<string, unknown> | null;
  }>)) {
    const runId = await createSyncRun({
      workspaceId: job.workspace_id,
      crmConnectionId: job.crm_connection_id,
      direction: "push",
    });

    try {
      await supabase
        .from("crm_push_jobs")
        .update({
          status: "running",
          attempts: job.attempts + 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      const connection = await maybeRefreshConnection(await getCrmConnectionById(job.crm_connection_id));
      const adapter = getCRMAdapter(connection.provider);
      await adapter.writeback(connection, {
        externalContactId: String(job.payload_jsonb?.externalContactId ?? ""),
        email: String(job.payload_jsonb?.email ?? ""),
        eventType: String(job.payload_jsonb?.eventType ?? "activity"),
        summary: String(job.payload_jsonb?.summary ?? "OutboundFlow activity"),
        metadata: (job.payload_jsonb?.metadata as Record<string, unknown> | undefined) ?? {},
      });

      await supabase
        .from("crm_push_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      await updateCrmConnection(connection.id, {
        status: connection.status === "error" ? "connected" : connection.status,
        last_writeback_at: new Date().toISOString(),
        last_error: null,
      });
      await completeSyncRun({
        runId,
        status: "completed",
        exportedCount: 1,
      });
      processed += 1;
    } catch (error) {
      const attempts = job.attempts + 1;
      const message = error instanceof Error ? error.message : "Unknown CRM push failure";
      await supabase
        .from("crm_push_jobs")
        .update({
          status: attempts >= job.max_attempts ? "failed" : "pending",
          error_message: message,
          next_attempt_at: new Date(Date.now() + Math.min(attempts, 5) * 60_000).toISOString(),
        })
        .eq("id", job.id);
      await updateCrmConnection(job.crm_connection_id, {
        last_error: message,
      });
      await completeSyncRun({
        runId,
        status: "failed",
        errorMessage: message,
      });
    }
  }

  return { processed };
}
