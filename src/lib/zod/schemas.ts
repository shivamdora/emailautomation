import { z } from "zod";

export const authSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const emailOnlySchema = z.object({
  email: z.email(),
  password: z.string().optional(),
});

export const profileSchema = z.object({
  fullName: z.string().min(2).max(100),
  title: z.string().max(120).optional().or(z.literal("")),
});

export const templateSchema = z
  .object({
    name: z.string().min(2).max(80),
    subjectTemplate: z.string().min(3).max(180),
    mode: z.enum(["text", "html"]),
    bodyTemplate: z.string().optional().or(z.literal("")),
    bodyHtmlTemplate: z.string().optional().or(z.literal("")),
  })
  .superRefine((value, context) => {
    if (value.mode === "text" && (!value.bodyTemplate || value.bodyTemplate.trim().length < 10)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bodyTemplate"],
        message: "Text mode requires at least 10 characters.",
      });
    }

    if (
      value.mode === "html" &&
      (!value.bodyHtmlTemplate || value.bodyHtmlTemplate.trim().length < 10)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bodyHtmlTemplate"],
        message: "HTML mode requires a HTML body.",
      });
    }
  });

export const manualContactSchema = z.object({
  email: z.email(),
  firstName: z.string().max(120).optional().or(z.literal("")),
  lastName: z.string().max(120).optional().or(z.literal("")),
  company: z.string().max(160).optional().or(z.literal("")),
  website: z.string().max(255).optional().or(z.literal("")),
  jobTitle: z.string().max(160).optional().or(z.literal("")),
});

export const contactTagsSchema = z.object({
  tagNames: z.array(z.string().trim().min(1).max(60)).max(20),
});

export const contactUpdateSchema = manualContactSchema.extend({
  tagNames: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});

export const bulkDeleteContactsSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1),
});

export const bulkTagContactsSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1),
  operation: z.enum(["add", "remove"]),
  tagNames: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
});

export const campaignStepSchema = z
  .object({
    subject: z.string().min(3),
    mode: z.enum(["text", "html"]),
    body: z.string().optional().or(z.literal("")),
    bodyHtml: z.string().optional().or(z.literal("")),
  })
  .superRefine((value, context) => {
    if (value.mode === "text" && (!value.body || value.body.trim().length < 10)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body"],
        message: "Text mode requires at least 10 characters.",
      });
    }

    if (value.mode === "html" && (!value.bodyHtml || value.bodyHtml.trim().length < 10)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bodyHtml"],
        message: "HTML mode requires a HTML body.",
      });
    }
  });

export const campaignLaunchSchema = z.object({
  campaignName: z.string().min(2).max(120),
  gmailAccountId: z.string().uuid(),
  contactListId: z.string().uuid().optional().or(z.literal("")),
  targetContactIds: z.array(z.string().uuid()).min(1),
  timezone: z.string().min(2),
  sendWindowStart: z.string().regex(/^\d{2}:\d{2}$/),
  sendWindowEnd: z.string().regex(/^\d{2}:\d{2}$/),
  dailySendLimit: z.coerce.number().int().min(1).max(500),
  primaryStep: campaignStepSchema,
  followupStep: campaignStepSchema,
});

export const googleSheetsImportSchema = z.object({
  url: z.url(),
});

export const customCrmPayloadSchema = z.object({
  workspaceId: z.string().uuid(),
  externalSource: z.string().min(2),
  contacts: z.array(
    z.object({
      externalContactId: z.string().min(1),
      email: z.email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      company: z.string().optional(),
      website: z.string().optional(),
      jobTitle: z.string().optional(),
      customFields: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .optional(),
    }),
  ),
});

export const pauseCampaignSchema = z.object({
  campaignId: z.string().uuid(),
  status: z.enum(["paused", "active"]),
});

export const sendNowCampaignSchema = z.object({
  campaignId: z.string().uuid(),
});

export const resendCampaignContactSchema = z.object({
  campaignContactId: z.string().uuid(),
});

export const inboxReplySchema = z.object({
  threadRecordId: z.string().uuid(),
  body: z.string().min(3),
});
