export function stripHtmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeEmailHtmlDocument(html: string) {
  if (/<html[\s>]/i.test(html)) {
    return html;
  }

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>${html}</body>
</html>`;
}

function isSafeUrl(url: string) {
  return /^(https?:|mailto:|tel:|data:image\/|cid:|#|\/)/i.test(url.trim());
}

export function sanitizeHtml(html: string) {
  if (!html.trim()) {
    return "";
  }

  if (typeof window === "undefined") {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
      .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:.*?\2/gi, "");
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(normalizeEmailHtmlDocument(html), "text/html");
  const blockedTags = new Set([
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "button",
    "meta",
    "base",
    "link",
  ]);

  for (const element of Array.from(documentNode.querySelectorAll("*"))) {
    const tagName = element.tagName.toLowerCase();

    if (blockedTags.has(tagName)) {
      element.remove();
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value ?? "";

      if (name.startsWith("on") || name === "srcdoc") {
        element.removeAttribute(attribute.name);
        continue;
      }

      if ((name === "href" || name === "src") && value && !isSafeUrl(value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  const headStyles = Array.from(documentNode.head.querySelectorAll("style"))
    .map((style) => style.outerHTML)
    .join("");

  return `${headStyles}${documentNode.body.innerHTML}`.trim();
}
