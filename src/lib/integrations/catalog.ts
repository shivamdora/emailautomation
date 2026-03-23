import "server-only";
import {
  isCalendlyConfigured,
  isHubSpotConfigured,
  isPipedriveConfigured,
  isSalesforceConfigured,
  isSlackConfigured,
  isZohoConfigured,
} from "@/lib/supabase/env";
import { OUTLOOK_ICON_URL } from "@/lib/mailboxes/provider";
import {
  type IntegrationCategory,
  type WorkspaceIntegrationProvider,
} from "@/lib/integrations/types";
import { type CrmProvider } from "@/services/crm-adapters";
import type { MailboxProviderKey } from "@/services/mailbox-providers/types";

export type IntegrationProviderKey = CrmProvider | WorkspaceIntegrationProvider | MailboxProviderKey;

export type IntegrationCatalogEntry = {
  key: IntegrationProviderKey;
  category: IntegrationCategory;
  title: string;
  shortValue: string;
  enables: string;
  customerRequirement: string;
  authType: "oauth" | "api_key" | "webhook" | "managed_api_key";
  sortOrder: number;
  detailOrder: number;
  capabilityTags: string[];
  icon: "crm" | "automation" | "shield" | "calendar" | "custom" | "mail";
  iconUrl?: string | null;
  available: boolean;
};

const catalog: IntegrationCatalogEntry[] = [
  {
    key: "hubspot",
    category: "crm_sync",
    title: "HubSpot",
    shortValue: "Sync contacts and write activity back into HubSpot.",
    enables: "OAuth sync, contact import, reply writeback, and status mapping.",
    customerRequirement: "Customer needs a HubSpot account with OAuth access.",
    authType: "oauth",
    sortOrder: 10,
    detailOrder: 10,
    capabilityTags: ["Contact sync", "Writeback", "OAuth"],
    icon: "crm",
    available: isHubSpotConfigured,
  },
  {
    key: "salesforce",
    category: "crm_sync",
    title: "Salesforce",
    shortValue: "Keep Salesforce contacts in sync with outbound activity.",
    enables: "OAuth sync, contact import, task writeback, and mapped status updates.",
    customerRequirement: "Customer needs a Salesforce org with API access enabled.",
    authType: "oauth",
    sortOrder: 20,
    detailOrder: 20,
    capabilityTags: ["Contact sync", "Tasks", "OAuth"],
    icon: "crm",
    available: isSalesforceConfigured,
  },
  {
    key: "pipedrive",
    category: "crm_sync",
    title: "Pipedrive",
    shortValue: "Pull people into campaigns and write activity back to Pipedrive.",
    enables: "OAuth sync, person import, note or activity writeback.",
    customerRequirement: "Customer needs a Pipedrive account and grants access during OAuth.",
    authType: "oauth",
    sortOrder: 30,
    detailOrder: 30,
    capabilityTags: ["Person sync", "Activities", "OAuth"],
    icon: "crm",
    available: isPipedriveConfigured,
  },
  {
    key: "zoho",
    category: "crm_sync",
    title: "Zoho CRM",
    shortValue: "Bring Zoho leads or contacts into OutboundFlow with reply writeback.",
    enables: "OAuth sync, contacts or leads import, notes or tasks, and mapped status updates.",
    customerRequirement: "Customer needs a Zoho CRM account and grants access during OAuth.",
    authType: "oauth",
    sortOrder: 40,
    detailOrder: 40,
    capabilityTags: ["Lead sync", "Tasks", "OAuth"],
    icon: "crm",
    available: isZohoConfigured,
  },
  {
    key: "custom_crm",
    category: "crm_sync",
    title: "Custom CRM",
    shortValue: "Push outbound events into an internal CRM with managed credentials.",
    enables: "Managed API key, signed webhook delivery, and internal CRM writeback.",
    customerRequirement: "Customer provides their CRM webhook endpoint or internal API consumer.",
    authType: "managed_api_key",
    sortOrder: 50,
    detailOrder: 50,
    capabilityTags: ["Managed key", "Webhook", "Internal systems"],
    icon: "custom",
    available: true,
  },
  {
    key: "slack",
    category: "automation_alerts",
    title: "Slack",
    shortValue: "Send reply, meeting, approval, and failure alerts into Slack.",
    enables: "OAuth connection plus configurable event notifications to one channel.",
    customerRequirement: "Customer chooses a Slack workspace and channel for alerts.",
    authType: "oauth",
    sortOrder: 10,
    detailOrder: 60,
    capabilityTags: ["Alerts", "Replies", "Failures"],
    icon: "automation",
    available: isSlackConfigured,
  },
  {
    key: "webhook",
    category: "automation_alerts",
    title: "Generic Webhooks",
    shortValue: "Fan events out to Zapier, Make, n8n, or internal automation.",
    enables: "Signed outbound event delivery with customer-selected event types.",
    customerRequirement: "Customer provides a webhook URL. Optional secret rotation is managed here.",
    authType: "webhook",
    sortOrder: 20,
    detailOrder: 70,
    capabilityTags: ["Automation", "Signed webhooks", "Custom routing"],
    icon: "automation",
    available: true,
  },
  {
    key: "hunter",
    category: "deliverability",
    title: "Hunter",
    shortValue: "Verify imported emails before they make it into campaign sends.",
    enables: "Import-time verification and optional pre-launch blocking for invalid contacts.",
    customerRequirement: "Customer adds their Hunter API key. Higher volume uses their paid credits or plan.",
    authType: "api_key",
    sortOrder: 10,
    detailOrder: 80,
    capabilityTags: ["Verification", "Import quality", "Pre-launch guardrails"],
    icon: "shield",
    available: true,
  },
  {
    key: "gmail",
    category: "mailboxes",
    title: "Gmail",
    shortValue: "Connect Gmail senders and workspace approvals on the sending page.",
    enables: "OAuth mailbox connection, sender approval, campaign sends, and reply sync from Gmail or Google Workspace.",
    customerRequirement: "Customer signs into Gmail or Google Workspace and grants mailbox permissions during OAuth.",
    authType: "oauth",
    sortOrder: 10,
    detailOrder: 85,
    capabilityTags: ["Mailbox connection", "Campaign sending", "Reply sync"],
    icon: "mail",
    available: true,
  },
  {
    key: "outlook",
    category: "mailboxes",
    title: "Outlook",
    shortValue: "Connect Microsoft 365 or Outlook senders with the same sender approval flow.",
    enables: "OAuth mailbox connection, sender approval, campaign sends, and reply sync through Microsoft Graph.",
    customerRequirement: "Customer signs into Outlook or Microsoft 365 and grants mailbox permissions during OAuth.",
    authType: "oauth",
    sortOrder: 20,
    detailOrder: 86,
    capabilityTags: ["Mailbox connection", "Campaign sending", "Reply sync"],
    icon: "mail",
    iconUrl: OUTLOOK_ICON_URL,
    available: true,
  },
  {
    key: "calendly",
    category: "meetings",
    title: "Calendly",
    shortValue: "Turn booked meetings into campaign exits and cleaner follow-up status.",
    enables: "OAuth connection, webhook processing, meeting-booked updates, and cancellation handling.",
    customerRequirement: "Customer connects Calendly and supplies their webhook signing key in setup.",
    authType: "oauth",
    sortOrder: 10,
    detailOrder: 90,
    capabilityTags: ["Meetings", "Webhooks", "Workflow exits"],
    icon: "calendar",
    available: isCalendlyConfigured,
  },
];

export function listIntegrationCatalog(options?: { includeUnavailable?: boolean }) {
  return catalog
    .filter((entry) => options?.includeUnavailable || entry.available)
    .sort((left, right) => left.detailOrder - right.detailOrder);
}

export function getIntegrationCatalogEntry(key: IntegrationProviderKey) {
  return catalog.find((entry) => entry.key === key) ?? null;
}

export function listCatalogByCategory(options?: { includeUnavailable?: boolean }) {
  const entries = listIntegrationCatalog(options);
  const grouped = new Map<IntegrationCategory, IntegrationCatalogEntry[]>();

  for (const entry of entries) {
    grouped.set(entry.category, [...(grouped.get(entry.category) ?? []), entry]);
  }

  return [
    { key: "crm_sync" as const, title: "CRM Sync", entries: grouped.get("crm_sync") ?? [] },
    {
      key: "automation_alerts" as const,
      title: "Automation & Alerts",
      entries: grouped.get("automation_alerts") ?? [],
    },
    {
      key: "deliverability" as const,
      title: "Deliverability",
      entries: grouped.get("deliverability") ?? [],
    },
    { key: "mailboxes" as const, title: "Mailboxes", entries: grouped.get("mailboxes") ?? [] },
    { key: "meetings" as const, title: "Meetings", entries: grouped.get("meetings") ?? [] },
  ];
}
