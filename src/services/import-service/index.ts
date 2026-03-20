import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireSupabaseConfiguration } from "@/lib/supabase/env";
import type { ContactRecord, ContactTag } from "@/lib/types/contact";
import { googleSheetsUrlToCsvUrl, parseImportFile, type ParsedImportRow } from "@/lib/utils/imports";

const CONTACT_SELECT =
  "id, email, first_name, last_name, company, website, job_title, source, unsubscribed_at, custom_fields_jsonb, contact_tag_members(contact_tags(id, name))";
const CONTACT_SELECT_FALLBACK =
  "id, email, first_name, last_name, company, website, job_title, source, unsubscribed_at, custom_fields_jsonb";

type NestedContactTagMember =
  | {
      contact_tags?:
        | {
            id: string;
            name: string;
          }
        | Array<{
            id: string;
            name: string;
          }>
        | null;
    }
  | null;

type ImportContactPayload = {
  workspace_id: string;
  project_id: string;
  owner_user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  website: string | null;
  job_title: string | null;
  source: "csv" | "xlsx" | "google_sheets";
  custom_fields_jsonb: Record<string, string | null>;
  tags: string[];
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeTagName(tagName: string) {
  return tagName.trim().replace(/\s+/g, " ");
}

function parseTagNames(value: string | string[] | null | undefined) {
  const values = Array.isArray(value) ? value : [value ?? ""];
  return Array.from(
    new Map(
      values
        .flatMap((entry) => String(entry).split(/[;,\n]/g))
        .map(normalizeTagName)
        .filter(Boolean)
        .map((entry) => [entry.toLowerCase(), entry]),
    ).values(),
  );
}

function normalizeImportKey(key: string) {
  return key.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function readImportValue(entries: Array<[string, string]>, matchers: string[]) {
  const matchSet = new Set(matchers);
  return entries.find(([key]) => matchSet.has(normalizeImportKey(key)))?.[1] ?? null;
}

function mapNestedTags(members: NestedContactTagMember[] | null | undefined): ContactTag[] {
  return (members ?? []).flatMap((member) => {
    const tagValue = member?.contact_tags;

    if (!tagValue) {
      return [];
    }

    return Array.isArray(tagValue) ? tagValue : [tagValue];
  });
}

function mapContactRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    email: String(row.email),
    first_name: (row.first_name as string | null | undefined) ?? null,
    last_name: (row.last_name as string | null | undefined) ?? null,
    company: (row.company as string | null | undefined) ?? null,
    website: (row.website as string | null | undefined) ?? null,
    job_title: (row.job_title as string | null | undefined) ?? null,
    source: (row.source as string | null | undefined) ?? null,
    unsubscribed_at: (row.unsubscribed_at as string | null | undefined) ?? null,
    custom_fields_jsonb: (row.custom_fields_jsonb as Record<string, unknown> | null | undefined) ?? null,
    tags: mapNestedTags(row.contact_tag_members as NestedContactTagMember[] | null | undefined),
  } satisfies ContactRecord;
}

function isSchemaCacheError(error: { message?: string | null; details?: string | null; hint?: string | null } | null | undefined) {
  const parts = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return (
    parts.includes("schema cache") ||
    parts.includes("could not find the table") ||
    parts.includes("could not find the relation") ||
    parts.includes("could not find the column") ||
    parts.includes("contact_tags") ||
    parts.includes("contact_tag_members")
  );
}

async function selectContactsWithTags(input: {
  workspaceId?: string;
  projectId?: string;
  contactIds?: string[];
}) {
  const supabase = createAdminSupabaseClient();
  let query = supabase.from("contacts").select(CONTACT_SELECT);

  if (input.workspaceId) {
    query = query.eq("workspace_id", input.workspaceId);
  }

  if (input.projectId) {
    query = query.eq("project_id", input.projectId);
  }

  if (input.contactIds?.length) {
    query = query.in("id", input.contactIds);
  }

  query = query.order("created_at", { ascending: false });

  let { data, error } = await query;

  if (error && isSchemaCacheError(error)) {
    let fallbackQuery = supabase.from("contacts").select(CONTACT_SELECT_FALLBACK);

    if (input.workspaceId) {
      fallbackQuery = fallbackQuery.eq("workspace_id", input.workspaceId);
    }

    if (input.projectId) {
      fallbackQuery = fallbackQuery.eq("project_id", input.projectId);
    }

    if (input.contactIds?.length) {
      fallbackQuery = fallbackQuery.in("id", input.contactIds);
    }

    fallbackQuery = fallbackQuery.order("created_at", { ascending: false });

    const fallbackResult = await fallbackQuery;
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...mapContactRecord(row),
    tags: Array.isArray(row.contact_tag_members) ? mapNestedTags(row.contact_tag_members as NestedContactTagMember[]) : [],
  }));
}

async function getContactsByIds(contactIds: string[]) {
  if (!contactIds.length) {
    return [];
  }

  return selectContactsWithTags({ contactIds });
}

export function mapImportRow(row: ParsedImportRow) {
  const entries = Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()] as [string, string]);
  const email = readImportValue(entries, ["email", "email_address", "work_email", "business_email"]);

  if (!email) {
    return null;
  }

  const knownKeys = new Set([
    "email",
    "email_address",
    "work_email",
    "business_email",
    "first_name",
    "firstname",
    "first",
    "name",
    "last_name",
    "lastname",
    "last",
    "company",
    "website",
    "company_website",
    "title",
    "job_title",
    "role",
    "tags",
    "tag",
  ]);

  return {
    email,
    first_name: readImportValue(entries, ["first_name", "firstname", "first", "name"]),
    last_name: readImportValue(entries, ["last_name", "lastname", "last"]),
    company: readImportValue(entries, ["company"]),
    website: readImportValue(entries, ["website", "company_website"]),
    job_title: readImportValue(entries, ["title", "job_title", "role"]),
    tags: parseTagNames(readImportValue(entries, ["tags", "tag"])),
    custom_fields_jsonb: Object.fromEntries(
      entries.filter(([key]) => !knownKeys.has(normalizeImportKey(key))),
    ),
  };
}

export async function listWorkspaceContactTags(workspaceId: string, projectId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("contact_tags")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("name", { ascending: true });

  if (error) {
    if (isSchemaCacheError(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []) as ContactTag[];
}

async function ensureWorkspaceTags(workspaceId: string, projectId: string, tagNames: string[]) {
  const normalizedNames = parseTagNames(tagNames);

  if (!normalizedNames.length) {
    return [] as ContactTag[];
  }

  const supabase = createAdminSupabaseClient();
  const existingTags = await listWorkspaceContactTags(workspaceId, projectId);
  const existingByNormalized = new Map(
    existingTags.map((tag) => [tag.name.toLowerCase(), tag]),
  );
  const missingNames = normalizedNames.filter((name) => !existingByNormalized.has(name.toLowerCase()));

  if (missingNames.length) {
    const { data: insertedTags, error: insertError } = await supabase
      .from("contact_tags")
      .insert(
        missingNames.map((name) => ({
          workspace_id: workspaceId,
          project_id: projectId,
          name,
        })),
      )
      .select("id, name");

    if (insertError) {
      if (isSchemaCacheError(insertError)) {
        return [];
      }
      throw insertError;
    }

    for (const tag of (insertedTags ?? []) as ContactTag[]) {
      existingByNormalized.set(tag.name.toLowerCase(), tag);
    }
  }

  return normalizedNames
    .map((name) => existingByNormalized.get(name.toLowerCase()))
    .filter((value): value is ContactTag => Boolean(value));
}

async function replaceContactTags(contactId: string, tagNames: string[], workspaceId: string, projectId: string) {
  const supabase = createAdminSupabaseClient();
  const tags = await ensureWorkspaceTags(workspaceId, projectId, tagNames);

  const deleteResult = await supabase.from("contact_tag_members").delete().eq("contact_id", contactId);

  if (deleteResult.error) {
    if (isSchemaCacheError(deleteResult.error)) {
      return;
    }
    throw deleteResult.error;
  }

  if (!tags.length) {
    return;
  }

  const { error } = await supabase.from("contact_tag_members").insert(
    tags.map((tag) => ({
      contact_id: contactId,
      tag_id: tag.id,
    })),
  );

  if (error) {
    if (isSchemaCacheError(error)) {
      return;
    }
    throw error;
  }
}

async function addTagsToContacts(contactIds: string[], tagNames: string[], workspaceId: string, projectId: string) {
  const tags = await ensureWorkspaceTags(workspaceId, projectId, tagNames);

  if (!contactIds.length || !tags.length) {
    return;
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("contact_tag_members").upsert(
    contactIds.flatMap((contactId) =>
      tags.map((tag) => ({
        contact_id: contactId,
        tag_id: tag.id,
      })),
    ),
    { onConflict: "contact_id,tag_id" },
  );

  if (error) {
    if (isSchemaCacheError(error)) {
      return;
    }
    throw error;
  }
}

async function removeTagsFromContacts(contactIds: string[], tagNames: string[], workspaceId: string, projectId: string) {
  if (!contactIds.length || !tagNames.length) {
    return;
  }

  const normalizedNames = new Set(parseTagNames(tagNames).map((name) => name.toLowerCase()));
  const existingTags = await listWorkspaceContactTags(workspaceId, projectId);
  const tags = existingTags.filter((tag) => normalizedNames.has(tag.name.toLowerCase()));

  if (!tags.length) {
    return;
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("contact_tag_members")
    .delete()
    .in("contact_id", contactIds)
    .in("tag_id", tags.map((tag) => tag.id));

  if (error) {
    if (isSchemaCacheError(error)) {
      return;
    }
    throw error;
  }
}

async function assignImportedTags(input: {
  workspaceId: string;
  projectId: string;
  contactsByEmail: Map<string, { id: string; email: string }>;
  tagsByEmail: Map<string, string[]>;
}) {
  const tagNames = Array.from(new Set(Array.from(input.tagsByEmail.values()).flat()));

  if (!tagNames.length) {
    return;
  }

  const tags = await ensureWorkspaceTags(input.workspaceId, input.projectId, tagNames);
  const tagIdsByName = new Map(tags.map((tag) => [tag.name.toLowerCase(), tag.id]));
  const assignments = Array.from(input.tagsByEmail.entries()).flatMap(([email, names]) => {
    const contact = input.contactsByEmail.get(email);

    if (!contact) {
      return [];
    }

    return parseTagNames(names).flatMap((name) => {
      const tagId = tagIdsByName.get(name.toLowerCase());
      return tagId ? [{ contact_id: contact.id, tag_id: tagId }] : [];
    });
  });

  if (!assignments.length) {
    return;
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("contact_tag_members")
    .upsert(assignments, { onConflict: "contact_id,tag_id" });

  if (error) {
    if (isSchemaCacheError(error)) {
      return;
    }
    throw error;
  }
}

export async function listContacts(workspaceId: string, projectId: string) {
  requireSupabaseConfiguration();
  return selectContactsWithTags({ workspaceId, projectId });
}

export async function createManualContact(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  website?: string | null;
  jobTitle?: string | null;
  tagNames?: string[];
}) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      owner_user_id: input.userId,
      email: normalizeEmail(input.email),
      first_name: input.firstName?.trim() || null,
      last_name: input.lastName?.trim() || null,
      company: input.company?.trim() || null,
      website: input.website?.trim() || null,
      job_title: input.jobTitle?.trim() || null,
      source: "manual",
    })
    .select("id")
    .single();

  if (error) {
    if (/duplicate key value/i.test(error.message)) {
      throw new Error("Contact already exists in this project.");
    }

    throw error;
  }

  const contactId = (data as { id: string }).id;

  if (input.tagNames?.length) {
    await replaceContactTags(contactId, input.tagNames, input.workspaceId, input.projectId);
  }

  const [contact] = await getContactsByIds([contactId]);
  return contact;
}

export async function updateContact(input: {
  workspaceId: string;
  projectId: string;
  contactId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  website?: string | null;
  jobTitle?: string | null;
  tagNames?: string[];
}) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      email: normalizeEmail(input.email),
      first_name: input.firstName?.trim() || null,
      last_name: input.lastName?.trim() || null,
      company: input.company?.trim() || null,
      website: input.website?.trim() || null,
      job_title: input.jobTitle?.trim() || null,
    })
    .eq("id", input.contactId)
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId);

  if (error) {
    if (/duplicate key value/i.test(error.message)) {
      throw new Error("Another contact already uses that email.");
    }

    throw error;
  }

  await replaceContactTags(input.contactId, input.tagNames ?? [], input.workspaceId, input.projectId);

  const [contact] = await getContactsByIds([input.contactId]);
  return contact;
}

export async function deleteContact(workspaceId: string, projectId: string, contactId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .eq("id", contactId);

  if (error) {
    throw error;
  }

  return { contactId };
}

export async function bulkDeleteContacts(workspaceId: string, projectId: string, contactIds: string[]) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .in("id", contactIds);

  if (error) {
    throw error;
  }

  return { deletedCount: contactIds.length };
}

export async function bulkTagContacts(input: {
  workspaceId: string;
  projectId: string;
  contactIds: string[];
  tagNames: string[];
  operation: "add" | "remove";
}) {
  requireSupabaseConfiguration();

  if (input.operation === "add") {
    await addTagsToContacts(input.contactIds, input.tagNames, input.workspaceId, input.projectId);
  } else {
    await removeTagsFromContacts(input.contactIds, input.tagNames, input.workspaceId, input.projectId);
  }

  return {
    contactIds: input.contactIds,
    operation: input.operation,
    tagNames: parseTagNames(input.tagNames),
  };
}

export async function listImports(workspaceId: string, projectId: string) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("imports")
    .select("id, file_name, source_type, status, imported_count, created_at")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data as Array<{
    id: string;
    file_name: string | null;
    source_type: string;
    status: string;
    imported_count: number;
    created_at?: string;
  }>;
}

export async function processImportFile(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  fileName: string;
  fileBuffer: ArrayBuffer;
  storagePath?: string | null;
  sourceType: "csv" | "xlsx" | "google_sheets";
}) {
  const rows = await parseImportFile(input.fileName, input.fileBuffer);

  if (!rows.length) {
    throw new Error("No rows found in the import file.");
  }

  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { data: rawImportRecord, error } = await supabase
    .from("imports")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      owner_user_id: input.userId,
      file_name: input.fileName,
      source_type: input.sourceType,
      status: "uploaded",
      imported_count: 0,
      storage_path: input.storagePath ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  const importRecord = rawImportRecord as { id: string };
  const mappedRows = rows.map(mapImportRow);
  const rowInserts = rows.map((row, index) => {
    const mappedPayload = mappedRows[index];

    return {
      import_id: importRecord.id,
      row_number: index + 1,
      raw_payload: row,
      mapped_payload: mappedPayload,
      status: mappedPayload ? "imported" : "failed",
      error_message: mappedPayload ? null : "Missing email column",
    };
  });

  await supabase.from("import_rows").insert(rowInserts);

  const dedupedContacts = Array.from(
    mappedRows
      .filter((row): row is NonNullable<ReturnType<typeof mapImportRow>> => Boolean(row))
      .reduce((accumulator, row) => {
        const email = normalizeEmail(String(row.email));
        const existing = accumulator.get(email);

        accumulator.set(email, {
          workspace_id: input.workspaceId,
          project_id: input.projectId,
          owner_user_id: input.userId,
          email,
          first_name: row.first_name,
          last_name: row.last_name,
          company: row.company,
          website: row.website,
          job_title: row.job_title,
          source: input.sourceType,
          custom_fields_jsonb: {
            ...(existing?.custom_fields_jsonb ?? {}),
            ...row.custom_fields_jsonb,
          },
          tags: Array.from(new Set([...(existing?.tags ?? []), ...row.tags])),
        });

        return accumulator;
      }, new Map<string, ImportContactPayload>()),
  ).map(([, value]) => value);

  if (dedupedContacts.length) {
    const emails = dedupedContacts.map((contact) => contact.email);
    const { data: existingContacts, error: existingContactsError } = await supabase
      .from("contacts")
      .select("id, email")
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", input.projectId)
      .in("email", emails);

    if (existingContactsError) {
      throw existingContactsError;
    }

    const existingByEmail = new Map(
      ((existingContacts as Array<{ id: string; email: string }> | null) ?? []).map((contact) => [
        normalizeEmail(contact.email),
        contact.id,
      ]),
    );

    const contactsToInsert = dedupedContacts.filter((contact) => !existingByEmail.has(contact.email));
    const contactsToUpdate = dedupedContacts.filter((contact) => existingByEmail.has(contact.email));

    if (contactsToInsert.length) {
      const { error: insertError } = await supabase.from("contacts").insert(
        contactsToInsert.map((contact) => ({
          workspace_id: contact.workspace_id,
          project_id: contact.project_id,
          owner_user_id: contact.owner_user_id,
          email: contact.email,
          first_name: contact.first_name,
          last_name: contact.last_name,
          company: contact.company,
          website: contact.website,
          job_title: contact.job_title,
          source: contact.source,
          custom_fields_jsonb: contact.custom_fields_jsonb,
        })),
      );

      if (insertError) {
        throw insertError;
      }
    }

    for (const contact of contactsToUpdate) {
      const existingContactId = existingByEmail.get(contact.email);

      if (!existingContactId) {
        continue;
      }

      const { error: updateError } = await supabase
        .from("contacts")
        .update({
          first_name: contact.first_name,
          last_name: contact.last_name,
          company: contact.company,
          website: contact.website,
          job_title: contact.job_title,
          source: contact.source,
          custom_fields_jsonb: contact.custom_fields_jsonb,
        })
        .eq("id", existingContactId);

      if (updateError) {
        throw updateError;
      }
    }

    const { data: importedContacts, error: importedContactsError } = await supabase
      .from("contacts")
      .select("id, email")
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", input.projectId)
      .in("email", emails);

    if (importedContactsError) {
      throw importedContactsError;
    }

    const contactsByEmail = new Map(
      ((importedContacts as Array<{ id: string; email: string }> | null) ?? []).map((contact) => [
        normalizeEmail(contact.email),
        contact,
      ]),
    );

    await assignImportedTags({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      contactsByEmail,
      tagsByEmail: new Map(dedupedContacts.map((contact) => [contact.email, contact.tags])),
    });
  }

  await supabase
    .from("imports")
    .update({
      status: "processed",
      imported_count: dedupedContacts.length,
    })
    .eq("id", importRecord.id);

  return {
    importId: importRecord.id,
    headers: Object.keys(rows[0] ?? {}),
    totalRows: rows.length,
    importedCount: dedupedContacts.length,
  };
}

export async function importFromGoogleSheet(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  url: string;
}) {
  const csvUrl = googleSheetsUrlToCsvUrl(input.url);
  const response = await fetch(csvUrl);

  if (!response.ok) {
    throw new Error("Failed to fetch Google Sheet as CSV.");
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("text/html")) {
    throw new Error("Google Sheet is not public or could not be exported as CSV.");
  }

  const buffer = await response.arrayBuffer();

  return processImportFile({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    userId: input.userId,
    fileName: "google-sheet.csv",
    fileBuffer: buffer,
    sourceType: "google_sheets",
  });
}
