import { z } from "zod";

export const projectSummarySchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  slug: z.string(),
  website: z.string().nullable(),
  logo_url: z.string().nullable(),
  brand_name: z.string().nullable(),
  sender_display_name: z.string().nullable(),
  sender_title: z.string().nullable(),
  sender_signature: z.string().nullable(),
});

export const workspaceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  kind: z.enum(["personal", "shared"]),
  role: z.enum(["owner", "admin", "member"]),
});

export const workspaceContextSchema = z.object({
  userId: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  workspaceLabel: z.string(),
  workspaceKind: z.enum(["personal", "shared"]),
  workspaceRole: z.enum(["owner", "admin", "member"]),
  userFirstName: z.string().nullable(),
  availableWorkspaces: z.array(workspaceSummarySchema),
  activeProjectId: z.string(),
  activeProject: projectSummarySchema,
  availableProjects: z.array(projectSummarySchema),
});

export const dashboardMetricsSchema = z.object({
  totalLeads: z.number(),
  queued: z.number(),
  sent: z.number(),
  followupSent: z.number(),
  replied: z.number(),
  unsubscribed: z.number(),
  failed: z.number(),
  replyRate: z.number(),
});

export const projectMetricsSchema = dashboardMetricsSchema.extend({
  projectId: z.string(),
});

export const campaignSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  daily_send_limit: z.number(),
  timezone: z.string(),
  created_at: z.string(),
});

export const contactTagSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const contactRecordSchema = z.object({
  id: z.string(),
  email: z.string(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  job_title: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  unsubscribed_at: z.string().nullable().optional(),
  custom_fields_jsonb: z.record(z.string(), z.unknown()).nullable().optional(),
  tags: z.array(contactTagSchema).optional(),
});

export const importSummarySchema = z.object({
  id: z.string(),
  file_name: z.string().nullable(),
  source_type: z.string(),
  status: z.string(),
  imported_count: z.number(),
  created_at: z.string().optional(),
});

export const templateListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  subject_template: z.string(),
  body_template: z.string(),
  body_html_template: z.string().nullable().optional(),
  preview_text: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  design_preset: z.string().nullable().optional(),
  is_system_template: z.boolean().nullable().optional(),
  system_key: z.string().nullable().optional(),
  created_at: z.string(),
});

export const replyRateSchema = z.object({
  name: z.string(),
  replyRate: z.number(),
});

export const inboxThreadSummarySchema = z.object({
  id: z.string(),
  subject: z.string().nullable(),
  senderEmail: z.string().nullable(),
  receivedAt: z.string().nullable(),
});

export const inboxThreadSummaryBatchSchema = z.object({
  threads: z.array(inboxThreadSummarySchema),
  hasMore: z.boolean(),
});
