import {
  FEATURED_TEMPLATE_SYSTEM_KEYS,
  resolveCanonicalTemplateSystemKey,
} from "@/lib/templates/default-templates";

export type TemplateListItem = {
  id: string;
  name: string;
  subject_template: string;
  body_template: string;
  body_html_template?: string | null;
  preview_text?: string | null;
  category?: string | null;
  tags?: string[] | null;
  design_preset?: string | null;
  is_system_template?: boolean | null;
  system_key?: string | null;
  created_at: string;
};

export type TemplateGalleryFilter = "all" | "default" | "saved" | "follow-up" | "launch";

function toTimestamp(value: string | undefined) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function buildExactTemplateFingerprint(template: TemplateListItem) {
  return JSON.stringify({
    name: template.name.trim().toLowerCase(),
    subject: template.subject_template.trim().toLowerCase(),
    body: template.body_template.trim(),
    bodyHtml: template.body_html_template?.trim() ?? "",
    category: template.category ?? "",
    designPreset: template.design_preset ?? "",
    tags: [...(template.tags ?? [])].sort(),
  });
}

function compareTemplatePriority(left: TemplateListItem, right: TemplateListItem) {
  const leftSystemScore = left.is_system_template ? 1 : 0;
  const rightSystemScore = right.is_system_template ? 1 : 0;

  if (leftSystemScore !== rightSystemScore) {
    return rightSystemScore - leftSystemScore;
  }

  return toTimestamp(right.created_at) - toTimestamp(left.created_at);
}

export function dedupeTemplates(templates: TemplateListItem[]) {
  const removedTemplateIds = new Set<string>();

  const canonicalGroups = new Map<string, TemplateListItem[]>();
  for (const template of templates) {
    const canonicalSystemKey = resolveCanonicalTemplateSystemKey(template);
    if (!canonicalSystemKey) {
      continue;
    }

    const group = canonicalGroups.get(canonicalSystemKey) ?? [];
    group.push(template);
    canonicalGroups.set(canonicalSystemKey, group);
  }

  for (const group of canonicalGroups.values()) {
    if (group.length < 2) {
      continue;
    }

    const [keep, ...duplicates] = [...group].sort(compareTemplatePriority);
    for (const duplicate of duplicates) {
      if (duplicate.id !== keep.id) {
        removedTemplateIds.add(duplicate.id);
      }
    }
  }

  const exactGroups = new Map<string, TemplateListItem[]>();
  for (const template of templates) {
    if (removedTemplateIds.has(template.id)) {
      continue;
    }

    const fingerprint = buildExactTemplateFingerprint(template);
    const group = exactGroups.get(fingerprint) ?? [];
    group.push(template);
    exactGroups.set(fingerprint, group);
  }

  for (const group of exactGroups.values()) {
    if (group.length < 2) {
      continue;
    }

    const [keep, ...duplicates] = [...group].sort(compareTemplatePriority);
    for (const duplicate of duplicates) {
      if (duplicate.id !== keep.id) {
        removedTemplateIds.add(duplicate.id);
      }
    }
  }

  return templates.filter((template) => !removedTemplateIds.has(template.id));
}

export function getFeaturedTemplates(templates: TemplateListItem[]) {
  const templatesBySystemKey = new Map<string, TemplateListItem>();

  for (const template of templates) {
    const canonicalSystemKey = resolveCanonicalTemplateSystemKey(template);
    if (!canonicalSystemKey || templatesBySystemKey.has(canonicalSystemKey)) {
      continue;
    }

    templatesBySystemKey.set(canonicalSystemKey, template);
  }

  return FEATURED_TEMPLATE_SYSTEM_KEYS.flatMap((systemKey) => {
    const template = templatesBySystemKey.get(systemKey);
    return template ? [template] : [];
  });
}

export function matchesTemplateQuery(template: TemplateListItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    template.name,
    template.subject_template,
    template.preview_text ?? "",
    template.category ?? "",
    template.design_preset ?? "",
    ...(template.tags ?? []),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

export function matchesTemplateFilter(template: TemplateListItem, filter: TemplateGalleryFilter) {
  switch (filter) {
    case "default":
      return Boolean(template.is_system_template);
    case "saved":
      return !template.is_system_template;
    case "follow-up":
      return template.category === "follow-up";
    case "launch":
      return template.category === "launch";
    case "all":
    default:
      return true;
  }
}

export function getTemplateModeLabel(template: Pick<TemplateListItem, "body_html_template">) {
  return template.body_html_template ? "HTML" : "Text";
}
