export const SIDEBAR_COLLAPSED_STORAGE_KEY = "outboundflow.desktop-sidebar-collapsed";

export function parseSidebarCollapsed(value: string | null | undefined) {
  return value === "true";
}

export function serializeSidebarCollapsed(value: boolean) {
  return value ? "true" : "false";
}
