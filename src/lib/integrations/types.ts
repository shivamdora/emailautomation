export type IntegrationCategory =
  | "crm_sync"
  | "automation_alerts"
  | "deliverability"
  | "meetings";

export type WorkspaceIntegrationProvider = "slack" | "webhook" | "hunter" | "calendly";

export type WorkspaceIntegrationStatus = "connected" | "error" | "disconnected";

export type IntegrationConnectionHealth = "healthy" | "needs_attention" | "error";
