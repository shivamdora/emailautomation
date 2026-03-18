import { stripHtmlToText } from "@/lib/utils/html";

type TemplateContext = {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  website?: string | null;
  job_title?: string | null;
  custom?: Record<string, string | number | boolean | null | undefined> | null;
};

export function renderTemplate(template: string, context: TemplateContext) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => {
    if (key.startsWith("custom.")) {
      const customKey = key.replace("custom.", "");
      return String(context.custom?.[customKey] ?? "");
    }

    const value = context[key as keyof TemplateContext];
    return value == null ? "" : String(value);
  });
}

export function previewRenderedTemplate(input: {
  subjectTemplate: string;
  bodyTemplate: string;
  bodyHtmlTemplate?: string | null;
  contact: TemplateContext;
}) {
  const renderedHtml = input.bodyHtmlTemplate
    ? renderTemplate(input.bodyHtmlTemplate, input.contact)
    : null;

  return {
    subject: renderTemplate(input.subjectTemplate, input.contact),
    body: renderTemplate(input.bodyTemplate, input.contact),
    bodyHtml: renderedHtml,
    textFallback: renderedHtml ? stripHtmlToText(renderedHtml) : renderTemplate(input.bodyTemplate, input.contact),
  };
}
