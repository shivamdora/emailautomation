import { escapeHtml, stripHtmlToText } from "@/lib/utils/html";

type TemplateContext = {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  website?: string | null;
  job_title?: string | null;
  custom?: Record<string, string | number | boolean | null | undefined> | null;
};

export type TemplateComposerMode = "text" | "html";
export type TemplateToolbarAction =
  | "paragraph"
  | "heading"
  | "bold"
  | "italic"
  | "underline"
  | "bullet-list"
  | "link"
  | "button"
  | "divider"
  | "spacer"
  | "quote"
  | "align-left"
  | "align-center";

const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i;

function normalizePlainText(value: string) {
  return value.replace(/\r\n/g, "\n");
}

function htmlifySelection(value: string) {
  return escapeHtml(value || "New copy").replace(/\n/g, "<br />");
}

export function convertPlainTextTemplateToHtml(value: string) {
  const normalized = normalizePlainText(value).trim();
  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("\n\n");
}

function buildBulletList(selection: string) {
  const items = normalizePlainText(selection)
    .split("\n")
    .map((item) => stripHtmlToText(item).trim())
    .filter(Boolean);

  const resolvedItems = items.length ? items : ["First point", "Second point"];

  return `<ul style="margin:0;padding-left:20px;color:#324750;">\n${resolvedItems
    .map((item) => `  <li>${escapeHtml(item)}</li>`)
    .join("\n")}\n</ul>`;
}

function resolveSelectionSnippet(action: TemplateToolbarAction, selection: string) {
  switch (action) {
    case "paragraph":
      return `<p>${htmlifySelection(selection)}</p>`;
    case "heading":
      return `<h2 style="margin:0 0 16px;font-size:28px;line-height:34px;font-weight:700;color:#10243a;">${htmlifySelection(selection || "Section heading")}</h2>`;
    case "bold":
      return `<strong>${htmlifySelection(selection || "Bold text")}</strong>`;
    case "italic":
      return `<em>${htmlifySelection(selection || "Italic text")}</em>`;
    case "underline":
      return `<u>${htmlifySelection(selection || "Underlined text")}</u>`;
    case "bullet-list":
      return buildBulletList(selection);
    case "link": {
      const text = stripHtmlToText(selection).trim() || "Read more";
      return `<a href="https://example.com" style="color:#0d5376;text-decoration:underline;">${escapeHtml(text)}</a>`;
    }
    case "button": {
      const text = stripHtmlToText(selection).trim() || "Call to action";
      return [
        `<div style="padding:8px 0 0;">`,
        `  <a href="https://example.com" style="display:inline-block;background:#0d5376;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:700;">${escapeHtml(text)}</a>`,
        `</div>`,
      ].join("\n");
    }
    case "divider":
      return `<hr style="margin:24px 0;border:none;border-top:1px solid #dbe5ed;" />`;
    case "spacer":
      return `<div style="height:24px;line-height:24px;">&nbsp;</div>`;
    case "quote":
      return `<blockquote style="margin:20px 0;padding:16px 18px;border-left:4px solid #9bc8d3;background:#f4f8fb;color:#10243a;font-style:italic;">${htmlifySelection(selection || "Quoted insight")}</blockquote>`;
    case "align-left":
      return `<div style="text-align:left;">${htmlifySelection(selection || "Left aligned copy")}</div>`;
    case "align-center":
      return `<div style="text-align:center;">${htmlifySelection(selection || "Centered copy")}</div>`;
    default:
      return selection;
  }
}

function insertIntoRange(input: {
  value: string;
  insertion: string;
  selectionStart: number;
  selectionEnd: number;
}) {
  const nextValue =
    input.value.slice(0, input.selectionStart) + input.insertion + input.value.slice(input.selectionEnd);
  const cursorPosition = input.selectionStart + input.insertion.length;

  return {
    value: nextValue,
    selectionStart: cursorPosition,
    selectionEnd: cursorPosition,
  };
}

export function detectTemplateComposerMode(value: string): TemplateComposerMode {
  return HTML_TAG_PATTERN.test(value) ? "html" : "text";
}

export function normalizeTemplateComposerInput(input: {
  bodyValue: string;
  preferredMode?: TemplateComposerMode | null;
}) {
  const rawValue = input.bodyValue ?? "";
  const detectedMode = detectTemplateComposerMode(rawValue);
  const resolvedMode = detectedMode === "html" ? "html" : (input.preferredMode ?? "text");

  if (resolvedMode === "html") {
    const html = rawValue.trim()
      ? detectedMode === "html"
        ? rawValue
        : convertPlainTextTemplateToHtml(rawValue)
      : "";

    return {
      mode: "html" as const,
      bodyTemplate: stripHtmlToText(html),
      bodyHtmlTemplate: html,
      editorValue: html,
      detectedMode,
    };
  }

  return {
    mode: "text" as const,
    bodyTemplate: rawValue,
    bodyHtmlTemplate: "",
    editorValue: rawValue,
    detectedMode,
  };
}

export function applyTemplateToolbarAction(input: {
  action: TemplateToolbarAction;
  value: string;
  selectionStart: number;
  selectionEnd: number;
}) {
  const selectedText = input.value.slice(input.selectionStart, input.selectionEnd);
  const insertion = resolveSelectionSnippet(input.action, selectedText);
  return insertIntoRange({
    value: input.value,
    insertion,
    selectionStart: input.selectionStart,
    selectionEnd: input.selectionEnd,
  });
}

export const TEMPLATE_BODY_TOKENS = ["{{first_name}}", "{{company}}", "{{website}}"] as const;

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
