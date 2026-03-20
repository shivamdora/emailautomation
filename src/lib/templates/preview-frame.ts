import { normalizeEmailHtmlDocument } from "@/lib/utils/html";

const PREVIEW_BASE_STYLE = `
  html, body {
    margin: 0;
    padding: 0;
    background: #eef2f4;
  }

  body {
    min-height: 100vh;
  }

  img {
    max-width: 100%;
  }
`;

function stripUnsafeTags(html: string) {
  return html
    .replace(/<(iframe|object|embed|form|button)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(meta|base|link|input)\b[^>]*\/?>/gi, "");
}

function sanitizePreviewHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\ssrcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, "")
    .replace(/\s(href|src)\s*=\s*javascript:[^\s>]+/gi, "");
}

export function buildEmailPreviewDocument(html: string) {
  const sanitized = stripUnsafeTags(sanitizePreviewHtml(html));
  const normalized = normalizeEmailHtmlDocument(sanitized);

  if (!sanitized.trim()) {
    return normalizeEmailHtmlDocument("");
  }

  if (/<head[\s>]/i.test(normalized)) {
    return normalized.replace(/<head([^>]*)>/i, `<head$1><style>${PREVIEW_BASE_STYLE}</style>`);
  }

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${PREVIEW_BASE_STYLE}</style>
  </head>
  <body>${sanitized}</body>
</html>`;
}
