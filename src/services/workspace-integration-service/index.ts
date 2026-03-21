import "server-only";
import { randomBytes } from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken, hashToken } from "@/lib/crypto/tokens";
import { requireSupabaseConfiguration } from "@/lib/supabase/env";
import { isMissingTableResult } from "@/lib/utils/supabase-schema";
import {
  type WorkspaceIntegrationProvider,
  type WorkspaceIntegrationStatus,
} from "@/lib/integrations/types";

export type WorkspaceIntegrationRecord = {
  id: string;
  workspace_id: string;
  provider: WorkspaceIntegrationProvider;
  auth_type: "oauth" | "api_key" | "webhook";
  status: WorkspaceIntegrationStatus;
  provider_account_id?: string | null;
  provider_account_label?: string | null;
  provider_account_email?: string | null;
  access_token_encrypted?: string | null;
  refresh_token_encrypted?: string | null;
  token_expiry?: string | null;
  api_key_encrypted?: string | null;
  api_key_hint?: string | null;
  signing_secret_encrypted?: string | null;
  signing_secret_hint?: string | null;
  config_jsonb?: Record<string, unknown> | null;
  last_event_at?: string | null;
  last_synced_at?: string | null;
  last_error?: string | null;
};

export type WorkspaceIntegrationOAuthExchange = {
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiry?: string | null;
  providerAccountId?: string | null;
  providerAccountLabel?: string | null;
  providerAccountEmail?: string | null;
  config?: Record<string, unknown>;
};

function createSecret(prefix: string) {
  return `${prefix}_${randomBytes(20).toString("hex")}`;
}

function normalizeHint(value: string) {
  return value.slice(-6);
}

async function updateWorkspaceIntegration(
  workspaceId: string,
  provider: WorkspaceIntegrationProvider,
  values: Record<string, unknown>,
) {
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("workspace_integrations")
    .update(values)
    .eq("workspace_id", workspaceId)
    .eq("provider", provider);

  if (result.error) {
    throw result.error;
  }
}

export async function listWorkspaceIntegrations(workspaceId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("workspace_integrations")
    .select(
      "id, workspace_id, provider, auth_type, status, provider_account_id, provider_account_label, provider_account_email, access_token_encrypted, refresh_token_encrypted, token_expiry, api_key_encrypted, api_key_hint, signing_secret_encrypted, signing_secret_hint, config_jsonb, last_event_at, last_synced_at, last_error",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (result.error) {
    if (isMissingTableResult(result, "workspace_integrations")) {
      return [] as WorkspaceIntegrationRecord[];
    }

    throw result.error;
  }

  return (result.data ?? []) as WorkspaceIntegrationRecord[];
}

export async function getWorkspaceIntegrationByProvider(
  workspaceId: string,
  provider: WorkspaceIntegrationProvider,
) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("workspace_integrations")
    .select(
      "id, workspace_id, provider, auth_type, status, provider_account_id, provider_account_label, provider_account_email, access_token_encrypted, refresh_token_encrypted, token_expiry, api_key_encrypted, api_key_hint, signing_secret_encrypted, signing_secret_hint, config_jsonb, last_event_at, last_synced_at, last_error",
    )
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();

  if (result.error) {
    if (isMissingTableResult(result, "workspace_integrations")) {
      return null;
    }

    throw result.error;
  }

  return (result.data as WorkspaceIntegrationRecord | null) ?? null;
}

export async function storeOAuthWorkspaceIntegration(input: {
  workspaceId: string;
  provider: Extract<WorkspaceIntegrationProvider, "slack" | "calendly">;
  exchange: WorkspaceIntegrationOAuthExchange;
}) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const payload = {
    workspace_id: input.workspaceId,
    provider: input.provider,
    auth_type: "oauth",
    status: "connected",
    provider_account_id: input.exchange.providerAccountId ?? null,
    provider_account_label: input.exchange.providerAccountLabel ?? input.provider,
    provider_account_email: input.exchange.providerAccountEmail ?? null,
    access_token_encrypted: encryptToken(input.exchange.accessToken),
    refresh_token_encrypted: input.exchange.refreshToken
      ? encryptToken(input.exchange.refreshToken)
      : null,
    token_expiry: input.exchange.tokenExpiry ?? null,
    config_jsonb: input.exchange.config ?? {},
    last_error: null,
  };

  const { data, error } = await (
    supabase.from("workspace_integrations") as unknown as {
      upsert: (
        value: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        select: (columns: string) => {
          single: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    }
  )
    .upsert(payload, { onConflict: "workspace_id,provider" })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data as { id: string };
}

export async function saveWebhookWorkspaceIntegration(input: {
  workspaceId: string;
  webhookUrl: string;
  eventTypes: string[];
}) {
  requireSupabaseConfiguration();
  const existing = await getWorkspaceIntegrationByProvider(input.workspaceId, "webhook");
  const signingSecret = existing?.signing_secret_encrypted
    ? decryptToken(existing.signing_secret_encrypted)
    : createSecret("ofwh");

  const supabase = createAdminSupabaseClient();
  const { data, error } = await (
    supabase.from("workspace_integrations") as unknown as {
      upsert: (
        value: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        select: (columns: string) => {
          single: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    }
  )
    .upsert(
      {
        workspace_id: input.workspaceId,
        provider: "webhook",
        auth_type: "webhook",
        status: "connected",
        provider_account_label: (() => {
          try {
            return new URL(input.webhookUrl).host;
          } catch {
            return "Webhook endpoint";
          }
        })(),
        provider_account_email: null,
        signing_secret_encrypted: encryptToken(signingSecret),
        signing_secret_hint: normalizeHint(signingSecret),
        config_jsonb: {
          webhookUrl: input.webhookUrl.trim(),
          eventTypes: Array.from(new Set(input.eventTypes)),
        },
        last_error: null,
      },
      { onConflict: "workspace_id,provider" },
    )
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return {
    integrationId: (data as { id: string }).id,
    signingSecret: existing?.signing_secret_encrypted ? null : signingSecret,
  };
}

export async function rotateWebhookWorkspaceIntegrationSecret(workspaceId: string) {
  requireSupabaseConfiguration();
  const secret = createSecret("ofwh");
  await updateWorkspaceIntegration(workspaceId, "webhook", {
    signing_secret_encrypted: encryptToken(secret),
    signing_secret_hint: normalizeHint(secret),
    last_error: null,
  });

  return { signingSecret: secret };
}

export async function saveHunterWorkspaceIntegration(input: {
  workspaceId: string;
  apiKey: string;
  verifyOnImport: boolean;
  preLaunchRule: "warn_only" | "block_invalid";
}) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await (
    supabase.from("workspace_integrations") as unknown as {
      upsert: (
        value: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        select: (columns: string) => {
          single: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    }
  )
    .upsert(
      {
        workspace_id: input.workspaceId,
        provider: "hunter",
        auth_type: "api_key",
        status: "connected",
        provider_account_label: "Hunter",
        provider_account_email: null,
        api_key_encrypted: encryptToken(input.apiKey.trim()),
        api_key_hint: normalizeHint(input.apiKey.trim()),
        config_jsonb: {
          verifyOnImport: input.verifyOnImport,
          preLaunchRule: input.preLaunchRule,
        },
        last_error: null,
      },
      { onConflict: "workspace_id,provider" },
    )
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data as { id: string };
}

export async function updateSlackWorkspaceIntegrationConfig(input: {
  workspaceId: string;
  channelId: string;
  eventTypes: string[];
}) {
  requireSupabaseConfiguration();
  const current = await getWorkspaceIntegrationByProvider(input.workspaceId, "slack");

  if (!current) {
    throw new Error("Slack integration is not connected.");
  }

  await updateWorkspaceIntegration(input.workspaceId, "slack", {
    config_jsonb: {
      ...(current.config_jsonb ?? {}),
      channelId: input.channelId.trim(),
      eventTypes: Array.from(new Set(input.eventTypes)),
    },
    last_error: null,
  });
}

export async function updateCalendlyWorkspaceIntegrationConfig(input: {
  workspaceId: string;
  signingKey: string;
  eventTypes: string[];
}) {
  requireSupabaseConfiguration();
  const current = await getWorkspaceIntegrationByProvider(input.workspaceId, "calendly");

  if (!current) {
    throw new Error("Calendly integration is not connected.");
  }

  await updateWorkspaceIntegration(input.workspaceId, "calendly", {
    config_jsonb: {
      ...(current.config_jsonb ?? {}),
      signingKeyHash: hashToken(input.signingKey.trim()),
      eventTypes: Array.from(new Set(input.eventTypes)),
    },
    signing_secret_encrypted: encryptToken(input.signingKey.trim()),
    signing_secret_hint: normalizeHint(input.signingKey.trim()),
    last_error: null,
  });
}

export async function disconnectWorkspaceIntegration(workspaceId: string, integrationId: string) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("workspace_integrations")
    .update({
      status: "disconnected",
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      token_expiry: null,
      api_key_encrypted: null,
      last_error: null,
    })
    .eq("workspace_id", workspaceId)
    .eq("id", integrationId);

  if (result.error) {
    throw result.error;
  }
}

export async function markWorkspaceIntegrationEvent(input: {
  workspaceId: string;
  provider: WorkspaceIntegrationProvider;
  kind: "event" | "sync";
}) {
  requireSupabaseConfiguration();

  await updateWorkspaceIntegration(input.workspaceId, input.provider, {
    ...(input.kind === "event"
      ? { last_event_at: new Date().toISOString() }
      : { last_synced_at: new Date().toISOString() }),
    status: "connected",
    last_error: null,
  });
}

export async function markWorkspaceIntegrationError(input: {
  workspaceId: string;
  provider: WorkspaceIntegrationProvider;
  error: string;
}) {
  requireSupabaseConfiguration();

  await updateWorkspaceIntegration(input.workspaceId, input.provider, {
    status: "error",
    last_error: input.error.slice(0, 500),
  });
}

export async function getWorkspaceIntegrationDispatchTargets(workspaceId: string) {
  const integrations = await listWorkspaceIntegrations(workspaceId);

  return integrations
    .filter((integration) => integration.status !== "disconnected")
    .map((integration) => ({
      ...integration,
      accessToken: integration.access_token_encrypted
        ? decryptToken(integration.access_token_encrypted)
        : null,
      apiKey: integration.api_key_encrypted
        ? decryptToken(integration.api_key_encrypted)
        : null,
      signingSecret: integration.signing_secret_encrypted
        ? decryptToken(integration.signing_secret_encrypted)
        : null,
    }));
}

export async function getWorkspaceHunterConfiguration(workspaceId: string) {
  const integration = await getWorkspaceIntegrationByProvider(workspaceId, "hunter");

  if (!integration || integration.status === "disconnected" || !integration.api_key_encrypted) {
    return null;
  }

  return {
    provider: integration.provider,
    apiKey: decryptToken(integration.api_key_encrypted),
    verifyOnImport: Boolean(integration.config_jsonb?.verifyOnImport),
    preLaunchRule:
      integration.config_jsonb?.preLaunchRule === "block_invalid" ? "block_invalid" : "warn_only",
  } as const;
}

export async function listActiveWorkspaceIntegrationsByProvider(
  provider: WorkspaceIntegrationProvider,
) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("workspace_integrations")
    .select(
      "id, workspace_id, provider, auth_type, status, provider_account_id, provider_account_label, provider_account_email, access_token_encrypted, refresh_token_encrypted, token_expiry, api_key_encrypted, api_key_hint, signing_secret_encrypted, signing_secret_hint, config_jsonb, last_event_at, last_synced_at, last_error",
    )
    .eq("provider", provider)
    .in("status", ["connected", "error"]);

  if (result.error) {
    if (isMissingTableResult(result, "workspace_integrations")) {
      return [] as WorkspaceIntegrationRecord[];
    }

    throw result.error;
  }

  return (result.data ?? []) as WorkspaceIntegrationRecord[];
}
