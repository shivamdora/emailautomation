import { type IntegrationCategory, type IntegrationConnectionHealth } from "@/lib/integrations/types";

export type IntegrationProviderKey =
  | "hubspot"
  | "salesforce"
  | "pipedrive"
  | "zoho"
  | "custom_crm"
  | "slack"
  | "webhook"
  | "hunter"
  | "gmail"
  | "outlook"
  | "calendly";

export type IntegrationCatalogAuthType = "oauth" | "api_key" | "webhook" | "managed_api_key";

export type IntegrationCatalogIcon = "crm" | "automation" | "shield" | "calendar" | "custom" | "mail";

export type IntegrationHubTileStatus = "available" | "connected" | "error" | "disconnected";

export type IntegrationHubMailboxSummary = {
  totalCount: number;
  readyCount: number;
  pendingCount: number;
};

export type IntegrationHubConnectionItem = {
  id: string;
  provider: IntegrationProviderKey;
  source: "crm" | "workspace";
  title: string;
  category: IntegrationCategory;
  categoryTitle: string;
  authType: IntegrationCatalogAuthType;
  accountLabel: string;
  accountSubLabel: string | null;
  summary: string;
  health: IntegrationConnectionHealth;
  status: string;
  lastActivityAt: string | null;
  lastActivityKind: "sync" | "writeback" | "event" | "activity" | null;
  lastError: string | null;
  keyHint: string | null;
  secretHint: string | null;
  webhookUrl: string | null;
  config: Record<string, unknown> | null;
  supportsSyncNow: boolean;
  supportsDisconnect: boolean;
  supportsManage: boolean;
  supportsRotateSecret: boolean;
  supportsUpdateKey: boolean;
};

export type IntegrationHubTile = {
  provider: IntegrationProviderKey;
  category: IntegrationCategory;
  status: IntegrationHubTileStatus;
  connectionCount: number;
  connectionSummary: string | null;
  primaryConnectionId: string | null;
  primaryAccountLabel: string | null;
  primaryHealth: IntegrationConnectionHealth | null;
} & {
  key: IntegrationProviderKey;
  title: string;
  shortValue: string;
  enables: string;
  customerRequirement: string;
  authType: IntegrationCatalogAuthType;
  sortOrder: number;
  detailOrder: number;
  capabilityTags: string[];
  icon: IntegrationCatalogIcon;
  iconUrl?: string | null;
  available: boolean;
};

export type IntegrationHubCategorySection = {
  key: IntegrationCategory;
  title: string;
  entries: IntegrationHubTile[];
};

export type IntegrationHubOverview = {
  connectedCount: number;
  needsAttentionCount: number;
  categoriesActiveCount: number;
};

export type IntegrationsHubData = {
  overview: IntegrationHubOverview;
  mailboxSummary: IntegrationHubMailboxSummary;
  connectedItems: IntegrationHubConnectionItem[];
  previousItems: IntegrationHubConnectionItem[];
  categories: IntegrationHubCategorySection[];
};
