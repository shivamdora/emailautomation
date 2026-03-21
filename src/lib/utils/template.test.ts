import { describe, expect, it } from "vitest";
import {
  applyTemplateToolbarAction,
  detectTemplateComposerMode,
  normalizeTemplateComposerInput,
} from "@/lib/utils/template";

describe("template composer helpers", () => {
  it("detects HTML content from pasted markup", () => {
    expect(detectTemplateComposerMode("<p>Hello {{first_name}}</p>")).toBe("html");
    expect(detectTemplateComposerMode("Hello {{first_name}}")).toBe("text");
  });

  it("normalizes plain text into HTML when HTML mode is preferred", () => {
    const normalized = normalizeTemplateComposerInput({
      bodyValue: "Hi {{first_name}},\n\nQuick idea for {{company}}.",
      preferredMode: "html",
    });

    expect(normalized.mode).toBe("html");
    expect(normalized.bodyHtmlTemplate).toContain("<p>");
    expect(normalized.bodyTemplate).toContain("Quick idea for {{company}}.");
    expect(normalized.editorValue).toContain("<p>");
  });

  it("keeps pasted HTML as HTML and generates a text fallback", () => {
    const normalized = normalizeTemplateComposerInput({
      bodyValue: "<p><strong>Hello</strong> {{first_name}}</p>",
    });

    expect(normalized.mode).toBe("html");
    expect(normalized.bodyHtmlTemplate).toContain("<strong>Hello</strong>");
    expect(normalized.bodyTemplate).toBe("Hello {{first_name}}");
  });

  it("inserts CTA button markup from the toolbar action", () => {
    const result = applyTemplateToolbarAction({
      action: "button",
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
    });

    expect(result.value).toContain("Call to action");
    expect(result.value).toContain("https://example.com");
  });

  it("wraps selected text with underline markup", () => {
    const result = applyTemplateToolbarAction({
      action: "underline",
      value: "Highlight this",
      selectionStart: 0,
      selectionEnd: "Highlight".length,
    });

    expect(result.value).toContain("<u>Highlight</u>");
  });

  it("inserts quote and alignment snippets for richer layout blocks", () => {
    const quoteResult = applyTemplateToolbarAction({
      action: "quote",
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
    });
    const alignResult = applyTemplateToolbarAction({
      action: "align-center",
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
    });

    expect(quoteResult.value).toContain("<blockquote");
    expect(quoteResult.value).toContain("Quoted insight");
    expect(alignResult.value).toContain('text-align:center;');
    expect(alignResult.value).toContain("Centered copy");
  });
});
