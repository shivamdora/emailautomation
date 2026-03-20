import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { customCrmPayloadSchema } from "@/lib/zod/schemas";
import { env, requireSupabaseConfiguration } from "@/lib/supabase/env";
import { resolveCustomCrmConnectionByApiKey } from "@/services/crm-service";

function getApiKeyWorkspaceMap() {
  return (env.CUSTOM_CRM_API_KEYS ?? "")
    .split(",")
    .filter(Boolean)
    .map((entry) => {
      const [workspaceId, key] = entry.split(":");
      return { workspaceId, key };
    });
}

export async function POST(request: Request) {
  requireSupabaseConfiguration();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  const payload = customCrmPayloadSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  const connection = await resolveCustomCrmConnectionByApiKey(payload.data.workspaceId, token).catch(() => null);
  const workspaceAuth = getApiKeyWorkspaceMap().find(
    (item) => item.key === token && item.workspaceId === payload.data.workspaceId,
  );

  if (!connection && !workspaceAuth) {
    return NextResponse.json({ error: "Invalid workspace API key" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  let syncRunId: string | null = null;

  if (connection) {
    const syncRun = await supabase
      .from("crm_sync_runs")
      .insert({
        workspace_id: payload.data.workspaceId,
        crm_connection_id: connection.id,
        direction: "pull",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    syncRunId = (syncRun.data as { id: string } | null)?.id ?? null;
  }

  const contactsTable = supabase.from("contacts") as unknown as {
    upsert: (
      values: Array<Record<string, unknown>>,
      options: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await contactsTable.upsert(
    payload.data.contacts.map((contact) => ({
      workspace_id: payload.data.workspaceId,
      owner_user_id: payload.data.workspaceId,
      external_source: payload.data.externalSource,
      external_contact_id: contact.externalContactId,
      email: contact.email,
      first_name: contact.firstName ?? null,
      last_name: contact.lastName ?? null,
      company: contact.company ?? null,
      website: contact.website ?? null,
      job_title: contact.jobTitle ?? null,
      custom_fields_jsonb: contact.customFields ?? {},
      source: "custom_crm",
    })),
    {
      onConflict: "workspace_id,external_source,external_contact_id",
    },
  );

  if (error) {
    if (syncRunId) {
      await supabase
        .from("crm_sync_runs")
        .update({
          status: "failed",
          error_message: error.message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncRunId);
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (connection) {
    const { data: localContacts } = await supabase
      .from("contacts")
      .select("id, external_contact_id")
      .eq("workspace_id", payload.data.workspaceId)
      .eq("external_source", payload.data.externalSource)
      .in(
        "external_contact_id",
        payload.data.contacts.map((contact) => contact.externalContactId),
      );

    const contactIdsByExternalId = new Map(
      ((localContacts ?? []) as Array<{ id: string; external_contact_id: string | null }>).map((contact) => [
        contact.external_contact_id,
        contact.id,
      ]),
    );

    await (
      supabase.from("crm_object_links") as unknown as {
        upsert: (
          values: Array<Record<string, unknown>>,
          options?: Record<string, unknown>,
        ) => Promise<{ error: { message: string } | null }>;
      }
    ).upsert(
      payload.data.contacts
        .map((contact) => ({
          workspace_id: payload.data.workspaceId,
          crm_connection_id: connection.id,
          object_type: "contact",
          external_object_id: contact.externalContactId,
          local_object_type: "contact",
          local_object_id: contactIdsByExternalId.get(contact.externalContactId),
          metadata: {
            email: contact.email,
            source: payload.data.externalSource,
          },
        }))
        .filter((contact) => Boolean(contact.local_object_id)),
      { onConflict: "crm_connection_id,object_type,external_object_id" },
    );

    await supabase
      .from("crm_connections")
      .update({
        status: "active",
        last_synced_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", connection.id);

    if (syncRunId) {
      await supabase
        .from("crm_sync_runs")
        .update({
          status: "completed",
          imported_count: payload.data.contacts.length,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncRunId);
    }
  }

  return NextResponse.json({ imported: payload.data.contacts.length });
}
