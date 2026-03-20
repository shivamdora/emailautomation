type SupabaseLike = {
  from: (table: string) => {
    select: (query: string) => {
      eq: (column: string, value: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
      in?: (column: string, values: unknown[]) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    insert: (values: unknown) => Promise<{ error: { message: string } | null }>;
  };
};

function isMissingTable(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("could not find the table") ||
    normalized.includes('does not exist')
  );
}

function buildSummary(eventType: string, metadata?: Record<string, unknown> | null) {
  const parts = [
    `OutboundFlow recorded a ${eventType} event.`,
    metadata?.subject ? `Subject: ${String(metadata.subject)}` : null,
    metadata?.disposition ? `Disposition: ${String(metadata.disposition)}` : null,
  ].filter(Boolean);
  return parts.join(" ");
}

export async function enqueueCrmWritebackJobs(input: {
  supabase: SupabaseLike;
  workspaceId: string;
  campaignContactId: string;
  eventType: string;
  metadata?: Record<string, unknown> | null;
}) {
  const campaignContactResult = await input.supabase
    .from("campaign_contacts")
    .select("contact_id")
    .eq("id", input.campaignContactId);

  if (campaignContactResult.error) {
    return;
  }

  const contactId = (campaignContactResult.data as Array<{ contact_id?: string | null }> | null)?.[0]?.contact_id;

  if (!contactId) {
    return;
  }

  const contactResult = await input.supabase
    .from("contacts")
    .select("id, email")
    .eq("id", contactId);

  if (contactResult.error) {
    return;
  }

  const contact = (contactResult.data as Array<{ id: string; email: string }> | null)?.[0];

  if (!contact) {
    return;
  }

  const connectionsResult = await input.supabase
    .from("crm_connections")
    .select("id")
    .eq("workspace_id", input.workspaceId);

  if (connectionsResult.error && !isMissingTable(connectionsResult.error.message)) {
    return;
  }

  const connections = (connectionsResult.data as Array<{ id: string }> | null) ?? [];

  if (!connections.length) {
    return;
  }

  const linkLookup = await input.supabase
    .from("crm_object_links")
    .select("crm_connection_id, external_object_id")
    .eq("workspace_id", input.workspaceId);

  const linkMap = new Map<string, string>();

  if (!linkLookup.error) {
    for (const link of (linkLookup.data as Array<{
      crm_connection_id: string;
      external_object_id: string;
      local_object_id?: string | null;
    }> | null) ?? []) {
      if (link.local_object_id === contact.id) {
        linkMap.set(link.crm_connection_id, link.external_object_id);
      }
    }
  }

  const payload = connections.map((connection) => ({
    workspace_id: input.workspaceId,
    crm_connection_id: connection.id,
    job_type: "activity_writeback",
    status: "pending",
    payload_jsonb: {
      externalContactId: linkMap.get(connection.id) ?? null,
      email: contact.email,
      eventType: input.eventType,
      summary: buildSummary(input.eventType, input.metadata),
      metadata: input.metadata ?? {},
    },
  }));

  if (!payload.length) {
    return;
  }

  const insertResult = await input.supabase.from("crm_push_jobs").insert(payload);

  if (insertResult.error && !isMissingTable(insertResult.error.message)) {
    console.error("Failed to queue CRM push jobs", insertResult.error.message);
  }
}
