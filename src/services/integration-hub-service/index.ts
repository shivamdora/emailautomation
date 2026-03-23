import "server-only";
import { getIntegrationCatalogEntry, listCatalogByCategory } from "@/lib/integrations/catalog";
import {
  type IntegrationHubConnectionItem,
  type IntegrationHubTile,
  type IntegrationHubTileStatus,
  type IntegrationsHubData,
} from "@/lib/integrations/hub";
import { type IntegrationConnectionHealth } from "@/lib/integrations/types";
import { listWorkspaceCrmConnections } from "@/services/crm-service";
import { getWorkspaceMailboxAccounts } from "@/services/mailbox-service";
import { listWorkspaceIntegrations } from "@/services/workspace-integration-service";

type CrmConnectionSummary = {
  id: string;
  provider: "hubspot" | "salesforce" | "pipedrive" | "zoho" | "custom_crm";
  status: string;
  auth_type?: string | null;
  provider_account_label?: string | null;
  provider_account_email?: string | null;
  inbound_api_key_hint?: string | null;
  outbound_webhook_url?: string | null;
  last_synced_at?: string | null;
  last_writeback_at?: string | null;
  last_error?: string | null;
};

type WorkspaceMailboxSummary = {
  id: string;
  provider: "gmail" | "outlook";
  status?: string | null;
  approval_status?: string | null;
  email_address?: string | null;
};

function normalizeCrmStatus(status: string): "connected" | "error" | "disconnected" {
  const normalized = status.trim().toLowerCase();

  if (normalized === "disconnected") {
    return "disconnected";
  }

  if (normalized === "error") {
    return "error";
  }

  return "connected";
}

function getConnectionHealth(input: {
  status: "connected" | "error" | "disconnected";
  lastError?: string | null;
  provider: string;
  source: "crm" | "workspace";
  config?: Record<string, unknown> | null;
  webhookUrl?: string | null;
  signingSecretHint?: string | null;
}) {
  if (input.status === "error") {
    return "error" satisfies IntegrationConnectionHealth;
  }

  if (input.source === "workspace") {
    if (input.provider === "slack" && !String(input.config?.channelId ?? "").trim()) {
      return "needs_attention" satisfies IntegrationConnectionHealth;
    }

    if (input.provider === "calendly" && !input.signingSecretHint) {
      return "needs_attention" satisfies IntegrationConnectionHealth;
    }

    if (input.provider === "webhook" && !String(input.webhookUrl ?? "").trim()) {
      return "needs_attention" satisfies IntegrationConnectionHealth;
    }
  }

  if (input.lastError) {
    return "needs_attention" satisfies IntegrationConnectionHealth;
  }

  return "healthy" satisfies IntegrationConnectionHealth;
}

function getCategoryTitle(category: IntegrationHubConnectionItem["category"]) {
  return listCatalogByCategory({ includeUnavailable: true }).find((section) => section.key === category)?.title ?? "Integrations";
}

function buildCrmConnectionItem(connection: CrmConnectionSummary): IntegrationHubConnectionItem {
  const catalog = getIntegrationCatalogEntry(connection.provider);

  if (!catalog) {
    throw new Error(`Missing integration catalog entry for CRM provider ${connection.provider}.`);
  }

  const status = normalizeCrmStatus(connection.status);
  const health = getConnectionHealth({
    status,
    lastError: connection.last_error ?? null,
    provider: connection.provider,
    source: "crm",
  });

  return {
    id: connection.id,
    provider: connection.provider,
    source: "crm",
    title: catalog.title,
    category: catalog.category,
    categoryTitle: getCategoryTitle(catalog.category),
    authType: catalog.authType,
    accountLabel: connection.provider_account_label?.trim() || catalog.title,
    accountSubLabel: connection.provider_account_email?.trim() || null,
    summary: catalog.shortValue,
    health,
    status,
    lastActivityAt:
      connection.last_writeback_at ??
      connection.last_synced_at ??
      null,
    lastActivityKind: connection.last_writeback_at
      ? "writeback"
      : connection.last_synced_at
        ? "sync"
        : null,
    lastError: connection.last_error?.trim() || null,
    keyHint: connection.inbound_api_key_hint?.trim() || null,
    secretHint: null,
    webhookUrl: connection.outbound_webhook_url?.trim() || null,
    config: null,
    supportsSyncNow: connection.provider !== "custom_crm",
    supportsDisconnect: true,
    supportsManage: true,
    supportsRotateSecret: false,
    supportsUpdateKey: false,
  };
}

function buildWorkspaceConnectionItem(connection: Awaited<ReturnType<typeof listWorkspaceIntegrations>>[number]): IntegrationHubConnectionItem {
  const catalog = getIntegrationCatalogEntry(connection.provider);

  if (!catalog) {
    throw new Error(`Missing integration catalog entry for integration provider ${connection.provider}.`);
  }

  const status = connection.status;
  const webhookUrl =
    typeof connection.config_jsonb?.webhookUrl === "string" ? connection.config_jsonb.webhookUrl : null;
  const health = getConnectionHealth({
    status,
    lastError: connection.last_error ?? null,
    provider: connection.provider,
    source: "workspace",
    config: connection.config_jsonb ?? null,
    webhookUrl,
    signingSecretHint: connection.signing_secret_hint ?? null,
  });

  return {
    id: connection.id,
    provider: connection.provider,
    source: "workspace",
    title: catalog.title,
    category: catalog.category,
    categoryTitle: getCategoryTitle(catalog.category),
    authType: catalog.authType,
    accountLabel: connection.provider_account_label?.trim() || catalog.title,
    accountSubLabel: connection.provider_account_email?.trim() || null,
    summary: catalog.shortValue,
    health,
    status,
    lastActivityAt: connection.last_event_at ?? connection.last_synced_at ?? null,
    lastActivityKind: connection.last_event_at
      ? "event"
      : connection.last_synced_at
        ? "sync"
        : null,
    lastError: connection.last_error?.trim() || null,
    keyHint: connection.api_key_hint?.trim() || null,
    secretHint: connection.signing_secret_hint?.trim() || null,
    webhookUrl,
    config: connection.config_jsonb ?? null,
    supportsSyncNow: false,
    supportsDisconnect: connection.provider === "slack" || connection.provider === "calendly",
    supportsManage: true,
    supportsRotateSecret: connection.provider === "webhook",
    supportsUpdateKey: connection.provider === "hunter",
  };
}

function buildTileStatus(connections: IntegrationHubConnectionItem[]): IntegrationHubTileStatus {
  const liveConnections = connections.filter((connection) => connection.status !== "disconnected");

  if (
    liveConnections.some(
      (connection) => connection.status === "error" || connection.health !== "healthy",
    )
  ) {
    return "error";
  }

  if (liveConnections.length) {
    return "connected";
  }

  if (connections.length) {
    return "disconnected";
  }

  return "available";
}

function buildTileConnectionSummary(connections: IntegrationHubConnectionItem[]) {
  const liveConnections = connections.filter((connection) => connection.status !== "disconnected");

  if (liveConnections.length === 1) {
    return liveConnections[0]?.accountLabel ?? null;
  }

  if (liveConnections.length > 1) {
    return `${liveConnections.length} connections live`;
  }

  if (connections.length) {
    return "Previously connected";
  }

  return null;
}

export async function getWorkspaceIntegrationsHubData(workspaceId: string): Promise<IntegrationsHubData> {
  const [crmConnections, workspaceIntegrations, mailboxAccounts] = await Promise.all([
    listWorkspaceCrmConnections(workspaceId),
    listWorkspaceIntegrations(workspaceId),
    getWorkspaceMailboxAccounts(workspaceId).catch(() => []),
  ]);

  const allConnections = [
    ...(crmConnections as CrmConnectionSummary[]).map(buildCrmConnectionItem),
    ...workspaceIntegrations.map(buildWorkspaceConnectionItem),
  ].sort((left, right) => {
    const leftCatalog = getIntegrationCatalogEntry(left.provider);
    const rightCatalog = getIntegrationCatalogEntry(right.provider);
    const leftOrder = leftCatalog?.detailOrder ?? 999;
    const rightOrder = rightCatalog?.detailOrder ?? 999;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    if (left.health !== right.health) {
      const weight = { error: 0, needs_attention: 1, healthy: 2 } as const;
      return weight[left.health] - weight[right.health];
    }

    return left.accountLabel.localeCompare(right.accountLabel);
  });

  const connectedItems = allConnections.filter((connection) => connection.status !== "disconnected");
  const previousItems = allConnections.filter((connection) => connection.status === "disconnected");

  const categories = listCatalogByCategory().map((section) => {
    const entries = section.entries.map((entry) => {
      const providerConnections = allConnections.filter((connection) => connection.provider === entry.key);
      const liveConnections = providerConnections.filter((connection) => connection.status !== "disconnected");
      const providerMailboxes = (mailboxAccounts as WorkspaceMailboxSummary[]).filter(
        (mailbox) => mailbox.provider === entry.key,
      );
      const liveMailboxes = providerMailboxes.filter((mailbox) => mailbox.status === "active");
      const hasMailboxAttention = liveMailboxes.some(
        (mailbox) => mailbox.approval_status && mailbox.approval_status !== "approved",
      );
      const mailboxTileStatus =
        liveMailboxes.length > 0
          ? hasMailboxAttention
            ? ("error" as const)
            : ("connected" as const)
          : providerMailboxes.length > 0
            ? ("disconnected" as const)
            : ("available" as const);

      return {
        ...entry,
        provider: entry.key,
        status: section.key === "mailboxes" ? mailboxTileStatus : buildTileStatus(providerConnections),
        connectionCount: section.key === "mailboxes" ? liveMailboxes.length : liveConnections.length,
        connectionSummary:
          section.key === "mailboxes"
            ? liveMailboxes.length === 1
              ? liveMailboxes[0]?.email_address ?? null
              : liveMailboxes.length > 1
                ? `${liveMailboxes.length} mailboxes ready`
                : providerMailboxes.length > 0
                  ? "Previously connected"
                  : null
            : buildTileConnectionSummary(providerConnections),
        primaryConnectionId: liveConnections[0]?.id ?? providerConnections[0]?.id ?? null,
        primaryAccountLabel:
          section.key === "mailboxes"
            ? liveMailboxes[0]?.email_address ?? providerMailboxes[0]?.email_address ?? null
            : liveConnections[0]?.accountLabel ?? providerConnections[0]?.accountLabel ?? null,
        primaryHealth:
          section.key === "mailboxes"
            ? liveMailboxes.length > 0
              ? hasMailboxAttention
                ? "needs_attention"
                : "healthy"
              : null
            : liveConnections[0]?.health ?? null,
      } satisfies IntegrationHubTile;
    });

    return {
      key: section.key,
      title: section.title,
      entries,
    };
  });

  const activeCategories = new Set(connectedItems.map((connection) => connection.category));
  const mailboxSummary = (mailboxAccounts as WorkspaceMailboxSummary[]).reduce(
    (summary, account) => {
      const active = String(account.status ?? "").trim().toLowerCase() === "active";
      const approved = String(account.approval_status ?? "").trim().toLowerCase() === "approved";
      const pending = !approved && active;

      return {
        totalCount: summary.totalCount + 1,
        readyCount: summary.readyCount + (active && approved ? 1 : 0),
        pendingCount: summary.pendingCount + (pending ? 1 : 0),
      };
    },
    {
      totalCount: 0,
      readyCount: 0,
      pendingCount: 0,
    },
  );

  if (mailboxSummary.totalCount > 0) {
    activeCategories.add("mailboxes");
  }

  return {
    overview: {
      connectedCount: connectedItems.length,
      needsAttentionCount: connectedItems.filter((connection) => connection.health !== "healthy").length,
      categoriesActiveCount: activeCategories.size,
    },
    mailboxSummary,
    connectedItems,
    previousItems,
    categories,
  };
}
