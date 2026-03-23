export type ProjectSummary = {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  website: string | null;
  logo_url: string | null;
  brand_name: string | null;
  sender_display_name: string | null;
  sender_title: string | null;
  sender_signature: string | null;
};

export type ProjectMailboxRegistryItem = ProjectSummary & {
  mailboxAccounts: Array<{
    id: string;
    provider: "gmail" | "outlook";
    email_address: string;
    provider_account_label?: string | null;
    status: string;
    approval_status?: string | null;
    approval_note?: string | null;
  }>;
  gmailAccounts: Array<{
    id: string;
    provider: "gmail" | "outlook";
    email_address: string;
    provider_account_label?: string | null;
    status: string;
    approval_status?: string | null;
    approval_note?: string | null;
  }>;
};

function sanitizeSlugSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildProjectSlug(name: string, suffix?: string) {
  const base = sanitizeSlugSegment(name) || "project";
  return suffix ? `${base}-${sanitizeSlugSegment(suffix)}` : base;
}

export function getProjectMonogram(project: Pick<ProjectSummary, "name" | "brand_name"> | null | undefined) {
  const source = project?.brand_name?.trim() || project?.name?.trim() || "Project";
  const letters = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return letters || "PR";
}
