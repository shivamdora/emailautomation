import "server-only";
import { readFileSync } from "fs";
import { join } from "path";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireSupabaseConfiguration } from "@/lib/supabase/env";
import {
  MEETING_FOLLOW_UP_SYSTEM_KEY,
  SHELTER_SCORE_SYSTEM_KEY,
  resolveCanonicalTemplateSystemKey,
} from "@/lib/templates/default-templates";
import { stripHtmlToText } from "@/lib/utils/html";
import { isMissingColumnError } from "@/lib/utils/supabase-schema";

function toTemplateSeedError(step: string, error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : `Unknown template seed error during ${step}.`;

  if (
    /column .*project_id/i.test(message) ||
    /Could not find the table ['"]public\.templates['"]/i.test(message) ||
    /relation ["']public\.templates["'] does not exist/i.test(message)
  ) {
    return new Error(
      `Template seeding requires the latest Supabase migrations. Failed during ${step}: ${message}. ` +
        "Apply the current migrations, including project-scoped templates, then reload the app.",
    );
  }

  return error instanceof Error ? error : new Error(`Template seeding failed during ${step}: ${message}`);
}

function isOnConflictConstraintMismatch(message: string) {
  return /no unique or exclusion constraint matching the ON CONFLICT specification/i.test(message);
}

type SeedTemplateDefinition = {
  systemKey: string;
  name: string;
  subjectTemplate: string;
  previewText: string;
  category: string;
  tags: string[];
  designPreset: string;
  bodyHtmlTemplate: string;
  bodyTemplate: string;
};

const DEFAULT_TEMPLATE_SEED_VERSION = 2;
const LEGACY_INTRO_SYSTEM_KEY = "system-intro-html-v1";
const LEGACY_INTRO_TEMPLATE_NAME = "Intro Outreach";
const SHELTER_SCORE_TEMPLATE_NAME = "Shelter Score Launch Template";

function normalizeShelterScoreTemplateHtml(html: string) {
  return html
    .replace(/\[Name\]/g, "{{first_name}}")
    .replace(
      /\s*<a href="#"[^>]*>\s*Unsubscribe\s*<\/a>\s*&nbsp;&nbsp;\|\s*&nbsp;&nbsp;\s*/i,
      "",
    )
    .trim();
}

function buildShelterScoreTemplateHtml() {
  const templatePath = join(process.cwd(), "email_templates", "shelterscore_tmp.html");
  return normalizeShelterScoreTemplateHtml(readFileSync(templatePath, "utf8"));
}

function buildShelterScoreTemplateText() {
  return `
Hi {{first_name}},

When a buyer compares multiple companies, trust often decides who gets the call. ShelterScore helps building and carport companies stand out with verification, customer reviews, and a stronger credibility signal buyers can see right away.

Why it helps:
- Look more credible from the first click
- Show buyers you are verified
- Strengthen your conversion path

Register your business:
https://shelterscore.com/list-your-business

See how ShelterScore works:
https://shelterscore.com/

If you want buyers to see your company as more established, more trustworthy, and easier to choose, ShelterScore is worth a closer look.

Best regards,
The ShelterScore Team

Privacy Policy:
https://shelterscore.com/privacy
  `.trim();
}

function buildMeetingFollowUpHtml() {
  return `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#eef4f4;font-family:'Trebuchet MS',Verdana,sans-serif;color:#132a36;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef4f4;padding:32px 18px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:26px;border:1px solid #d8e6e6;overflow:hidden;">
            <tr>
              <td style="padding:26px 30px;background:#132a36;color:#f7fbfb;">
                <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.75;">Meeting Follow-up</div>
                <h2 style="margin:12px 0 8px;font-size:28px;line-height:1.15;font-weight:700;">Worth putting 15 minutes on the calendar?</h2>
                <p style="margin:0;font-size:15px;line-height:1.7;color:#d4e4e5;">
                  A clean follow-up designed to turn interest into a booked conversation.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 30px 18px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.8;color:#1f2937;">Hi {{first_name}},</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.8;color:#425466;">
                  Circling back in case this got buried. If improving outbound consistency for {{company}} is already on the radar, I can walk you through a lightweight setup that keeps follow-up moving without creating extra admin work.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;">
                  <tr>
                    <td style="padding:18px 20px;border-radius:18px;background:#f4f8f8;border:1px solid #dbe7e7;">
                      <p style="margin:0 0 10px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#58707a;">Quick agenda</p>
                      <ul style="margin:0;padding-left:18px;color:#425466;font-size:15px;line-height:1.8;">
                        <li>Review your current follow-up flow</li>
                        <li>Show where opens, replies, and meeting intent get captured</li>
                        <li>Outline a next-step sequence tuned for booking meetings</li>
                      </ul>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.8;color:#425466;">
                  If you want, reply with <strong style="color:#132a36;">yes</strong> and I’ll send over a few times that work next week.
                </p>
                <a href="https://cal.com" style="display:inline-block;margin-top:8px;padding:13px 22px;border-radius:999px;background:#d36b4b;color:#fffaf6;text-decoration:none;font-weight:700;">
                  Book a short meeting
                </a>
                <p style="margin:26px 0 0;font-size:16px;line-height:1.7;color:#132a36;">
                  Thanks,<br />
                  {{sender_name}}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

function buildDefaultTemplates(): SeedTemplateDefinition[] {
  const shelterScoreHtml = buildShelterScoreTemplateHtml();
  const shelterScoreText = buildShelterScoreTemplateText();
  const meetingHtml = buildMeetingFollowUpHtml();

  return [
    {
      systemKey: SHELTER_SCORE_SYSTEM_KEY,
      name: SHELTER_SCORE_TEMPLATE_NAME,
      subjectTemplate: "ShelterScore for Trusted Building Companies",
      previewText:
        "Help buyers trust your company faster with ShelterScore verification, reviews, and a stronger online presence.",
      category: "launch",
      tags: ["html", "starter", "brand", "shelterscore", "launch"],
      designPreset: "shelterscore-brand",
      bodyHtmlTemplate: shelterScoreHtml,
      bodyTemplate: shelterScoreText,
    },
    {
      systemKey: MEETING_FOLLOW_UP_SYSTEM_KEY,
      name: "Meeting Booking Follow-up",
      subjectTemplate: "Worth a quick 15-minute chat for {{company}}?",
      previewText: "A designed follow-up focused on turning quiet interest into a booked meeting.",
      category: "follow-up",
      tags: ["html", "meeting-booking", "starter"],
      designPreset: "clean-briefing",
      bodyHtmlTemplate: meetingHtml,
      bodyTemplate: stripHtmlToText(meetingHtml),
    },
  ];
}

function createTemplateRows(workspaceId: string, projectId: string, userId: string) {
  return buildDefaultTemplates().map((template) => ({
    workspace_id: workspaceId,
    project_id: projectId,
    owner_user_id: userId,
    system_key: template.systemKey,
    is_system_template: true,
    seed_version: DEFAULT_TEMPLATE_SEED_VERSION,
    name: template.name,
    subject_template: template.subjectTemplate,
    body_template: template.bodyTemplate,
    body_html_template: template.bodyHtmlTemplate,
    category: template.category,
    tags: template.tags,
    preview_text: template.previewText,
    design_preset: template.designPreset,
  }));
}

async function backfillLegacyIntroTemplate(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  shelterScoreTemplateRow: Record<string, unknown>;
}) {
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("templates")
    .select("id, system_key, name, is_system_template")
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId);

  if (
    result.error &&
    (
      isMissingColumnError(result.error.message, "templates", "system_key") ||
      isMissingColumnError(result.error.message, "templates", "is_system_template")
    )
  ) {
    return;
  }

  if (result.error) {
    throw toTemplateSeedError("backfilling legacy templates", result.error);
  }

  const templates = (result.data ?? []) as Array<{
    id: string;
    system_key?: string | null;
    name?: string | null;
    is_system_template?: boolean | null;
  }>;
  const shelterScoreTemplate = templates.find(
    (template) => template.system_key === SHELTER_SCORE_SYSTEM_KEY,
  );
  const legacyIntroTemplates = templates.filter(
    (template) =>
      template.system_key === LEGACY_INTRO_SYSTEM_KEY ||
      (template.is_system_template && template.name === LEGACY_INTRO_TEMPLATE_NAME),
  );

  if (shelterScoreTemplate) {
    const duplicateLegacyIds = legacyIntroTemplates
      .map((template) => template.id)
      .filter((templateId) => templateId !== shelterScoreTemplate.id);

    if (duplicateLegacyIds.length) {
      const { error } = await supabase
        .from("templates")
        .delete()
        .eq("workspace_id", input.workspaceId)
        .eq("project_id", input.projectId)
        .in("id", duplicateLegacyIds);

      if (error) {
        throw toTemplateSeedError("removing duplicate legacy templates", error);
      }
    }

    return;
  }

  const legacyIntroTemplate = legacyIntroTemplates[0];

  if (!legacyIntroTemplate) {
    return;
  }

  const { error: updateError } = await supabase
    .from("templates")
    .update({
      owner_user_id: input.userId,
      system_key: input.shelterScoreTemplateRow.system_key,
      is_system_template: true,
      seed_version: input.shelterScoreTemplateRow.seed_version,
      name: input.shelterScoreTemplateRow.name,
      subject_template: input.shelterScoreTemplateRow.subject_template,
      body_template: input.shelterScoreTemplateRow.body_template,
      body_html_template: input.shelterScoreTemplateRow.body_html_template,
      category: input.shelterScoreTemplateRow.category,
      tags: input.shelterScoreTemplateRow.tags,
      preview_text: input.shelterScoreTemplateRow.preview_text,
      design_preset: input.shelterScoreTemplateRow.design_preset,
    })
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .eq("id", legacyIntroTemplate.id);

  if (updateError) {
    throw toTemplateSeedError("updating the canonical legacy template", updateError);
  }

  const duplicateLegacyIds = legacyIntroTemplates
    .slice(1)
    .map((template) => template.id)
    .filter(Boolean);

  if (duplicateLegacyIds.length) {
    const { error } = await supabase
      .from("templates")
      .delete()
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", input.projectId)
      .in("id", duplicateLegacyIds);

    if (error) {
      throw toTemplateSeedError("removing duplicate legacy templates", error);
    }
  }
}

async function normalizeKnownDefaultTemplates(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  templateRows: Array<Record<string, unknown>>;
}) {
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("templates")
    .select("id, name, subject_template, system_key, is_system_template, created_at")
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId);

  if (
    result.error &&
    (
      isMissingColumnError(result.error.message, "templates", "system_key") ||
      isMissingColumnError(result.error.message, "templates", "is_system_template")
    )
  ) {
    return;
  }

  if (result.error) {
    throw toTemplateSeedError("normalizing default templates", result.error);
  }

  const templates = (result.data ?? []) as Array<{
    id: string;
    name?: string | null;
    subject_template?: string | null;
    system_key?: string | null;
    is_system_template?: boolean | null;
    created_at?: string | null;
  }>;

  for (const templateRow of input.templateRows) {
    const systemKey = String(templateRow.system_key ?? "");
    if (!systemKey) {
      continue;
    }

    const candidates = templates.filter(
      (template) =>
        resolveCanonicalTemplateSystemKey(template) === systemKey,
    );

    if (!candidates.length) {
      continue;
    }

    const [keep, ...duplicates] = [...candidates].sort((left, right) => {
      const leftKeyScore = left.system_key === systemKey ? 1 : 0;
      const rightKeyScore = right.system_key === systemKey ? 1 : 0;

      if (leftKeyScore !== rightKeyScore) {
        return rightKeyScore - leftKeyScore;
      }

      const leftScore = left.is_system_template ? 1 : 0;
      const rightScore = right.is_system_template ? 1 : 0;

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      const leftTimestamp = left.created_at ? Date.parse(left.created_at) : 0;
      const rightTimestamp = right.created_at ? Date.parse(right.created_at) : 0;
      return rightTimestamp - leftTimestamp;
    });

    const { error: updateError } = await supabase
      .from("templates")
      .update({
        owner_user_id: input.userId,
        system_key: templateRow.system_key,
        is_system_template: templateRow.is_system_template,
        seed_version: templateRow.seed_version,
        name: templateRow.name,
        subject_template: templateRow.subject_template,
        body_template: templateRow.body_template,
        body_html_template: templateRow.body_html_template,
        category: templateRow.category,
        tags: templateRow.tags,
        preview_text: templateRow.preview_text,
        design_preset: templateRow.design_preset,
      })
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", input.projectId)
      .eq("id", keep.id);

    if (
      updateError &&
      (
        isMissingColumnError(updateError.message, "templates", "body_html_template") ||
        isMissingColumnError(updateError.message, "templates", "category")
      )
    ) {
      const { error: fallbackUpdateError } = await supabase
        .from("templates")
        .update({
          owner_user_id: input.userId,
          system_key: templateRow.system_key,
          is_system_template: templateRow.is_system_template,
          seed_version: templateRow.seed_version,
          name: templateRow.name,
          subject_template: templateRow.subject_template,
          body_template: templateRow.body_template,
        })
        .eq("workspace_id", input.workspaceId)
        .eq("project_id", input.projectId)
        .eq("id", keep.id);

      if (fallbackUpdateError) {
        throw toTemplateSeedError("normalizing fallback default templates", fallbackUpdateError);
      }
    } else if (updateError) {
      throw toTemplateSeedError("normalizing default templates", updateError);
    }

    const duplicateIds = duplicates.map((template) => template.id).filter(Boolean);
    if (!duplicateIds.length) {
      continue;
    }

    const { error: deleteError } = await supabase
      .from("templates")
      .delete()
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", input.projectId)
      .in("id", duplicateIds);

    if (deleteError) {
      throw toTemplateSeedError("deleting duplicate default templates", deleteError);
    }
  }
}

async function persistDefaultTemplatesWithoutUpsert(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  templateRows: Array<Record<string, unknown>>;
}) {
  const supabase = createAdminSupabaseClient();
  const templateKeys = input.templateRows.map((template) => String(template.system_key ?? "")).filter(Boolean);
  const existing = await supabase
    .from("templates")
    .select("id, system_key")
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .in("system_key", templateKeys);

  if (existing.error) {
    throw toTemplateSeedError("loading existing default templates", existing.error);
  }

  const existingBySystemKey = new Map(
    ((existing.data ?? []) as Array<{ id: string; system_key?: string | null }>)
      .filter((template) => template.system_key)
      .map((template) => [String(template.system_key), template.id]),
  );

  for (const templateRow of input.templateRows) {
    const existingId = existingBySystemKey.get(String(templateRow.system_key ?? ""));

    if (existingId) {
      const { error } = await supabase
        .from("templates")
        .update({
          owner_user_id: input.userId,
          system_key: templateRow.system_key,
          is_system_template: templateRow.is_system_template,
          seed_version: templateRow.seed_version,
          name: templateRow.name,
          subject_template: templateRow.subject_template,
          body_template: templateRow.body_template,
          body_html_template: templateRow.body_html_template,
          category: templateRow.category,
          tags: templateRow.tags,
          preview_text: templateRow.preview_text,
          design_preset: templateRow.design_preset,
        })
        .eq("workspace_id", input.workspaceId)
        .eq("project_id", input.projectId)
        .eq("id", existingId);

      if (error) {
        throw toTemplateSeedError("updating existing default templates", error);
      }

      continue;
    }

    const { error } = await supabase.from("templates").insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      owner_user_id: input.userId,
      system_key: templateRow.system_key,
      is_system_template: templateRow.is_system_template,
      seed_version: templateRow.seed_version,
      name: templateRow.name,
      subject_template: templateRow.subject_template,
      body_template: templateRow.body_template,
      body_html_template: templateRow.body_html_template,
      category: templateRow.category,
      tags: templateRow.tags,
      preview_text: templateRow.preview_text,
      design_preset: templateRow.design_preset,
    });

    if (error) {
      throw toTemplateSeedError("inserting missing default templates", error);
    }
  }
}

export async function ensureDefaultTemplatesForProject(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
}) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const templateRows = createTemplateRows(input.workspaceId, input.projectId, input.userId);
  const shelterScoreTemplateRow = templateRows.find(
    (template) => template.system_key === SHELTER_SCORE_SYSTEM_KEY,
  );

  if (shelterScoreTemplateRow) {
    await backfillLegacyIntroTemplate({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      userId: input.userId,
      shelterScoreTemplateRow,
    });
  }

  await normalizeKnownDefaultTemplates({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    userId: input.userId,
    templateRows,
  });

  let result = await (
    supabase.from("templates") as unknown as {
      upsert: (
        values: Array<Record<string, unknown>>,
        options?: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null; data?: unknown }>;
    }
  ).upsert(templateRows, {
    onConflict: "project_id,system_key",
    ignoreDuplicates: false,
  });

  if (
    result.error &&
    (
      isMissingColumnError(result.error.message, "templates", "system_key") ||
      isMissingColumnError(result.error.message, "templates", "body_html_template") ||
      isMissingColumnError(result.error.message, "templates", "category")
    )
  ) {
    const existing = await supabase
      .from("templates")
      .select("name")
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", input.projectId)
      .in("name", templateRows.map((template) => String(template.name)));

    if (existing.error) {
      throw toTemplateSeedError("checking existing default templates", existing.error);
    }

    const existingNames = new Set(
      ((existing.data ?? []) as Array<{ name: string | null }>).map((template) => template.name).filter(Boolean),
    );
    const fallbackRows = templateRows
      .filter((template) => !existingNames.has(String(template.name)))
      .map((template) => ({
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        owner_user_id: input.userId,
        name: template.name,
        subject_template: template.subject_template,
        body_template: template.body_template,
      }));

    if (!fallbackRows.length) {
      return;
    }

    result = await (
      supabase.from("templates") as unknown as {
        insert: (
          values: Array<Record<string, unknown>>,
        ) => Promise<{ error: { message: string } | null; data?: unknown }>;
      }
    ).insert(fallbackRows);
  } else if (result.error && isOnConflictConstraintMismatch(result.error.message)) {
    await persistDefaultTemplatesWithoutUpsert({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      userId: input.userId,
      templateRows,
    });
    return;
  }

  if (result.error) {
    throw toTemplateSeedError("upserting default templates", result.error);
  }
}

export async function ensureDefaultTemplatesForProjects(input: {
  workspaceId: string;
  projects: Array<{ id: string }>;
  userId: string;
}) {
  await Promise.all(
    input.projects.map((project) =>
      ensureDefaultTemplatesForProject({
        workspaceId: input.workspaceId,
        projectId: project.id,
        userId: input.userId,
      }),
    ),
  );
}

export async function ensureDefaultTemplatesForWorkspace(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
}) {
  return ensureDefaultTemplatesForProject(input);
}

export async function ensureDefaultTemplatesForWorkspaces(
  workspaces: Array<{ id: string; projects?: Array<{ id: string }> }>,
  userId: string,
) {
  await Promise.all(
    workspaces.flatMap((workspace) =>
      (workspace.projects ?? []).map((project) =>
        ensureDefaultTemplatesForProject({
          workspaceId: workspace.id,
          projectId: project.id,
          userId,
        }),
      ),
    ),
  );
}

export function getSeedTemplateDefinitions() {
  return buildDefaultTemplates();
}
