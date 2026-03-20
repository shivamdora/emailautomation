import { describe, expect, it } from "vitest";
import { buildEmailPreviewDocument } from "@/lib/templates/preview-frame";

describe("buildEmailPreviewDocument", () => {
  it("preserves styles while removing unsafe markup", () => {
    const document = buildEmailPreviewDocument(`
      <html>
        <head><style>.hero { color: red; }</style></head>
        <body>
          <script>alert('x')</script>
          <a href="javascript:alert('x')" onclick="alert('x')">Bad</a>
          <div class="hero">Hello</div>
        </body>
      </html>
    `);

    expect(document).toContain(".hero { color: red; }");
    expect(document).not.toContain("<script");
    expect(document).not.toContain("javascript:alert");
    expect(document).not.toContain("onclick=");
    expect(document).toContain("<html>");
    expect(document).toContain("<body>");
  });
});
