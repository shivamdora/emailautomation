import { describe, expect, it } from "vitest";
import { dedupeTemplates } from "@/lib/templates/gallery";

describe("dedupeTemplates", () => {
  it("collapses duplicated seeded templates and keeps the system template", () => {
    const templates = dedupeTemplates([
      {
        id: "seeded-new",
        name: "Meeting Booking Follow-up",
        subject_template: "Worth a quick 15-minute chat for {{company}}?",
        body_template: "new body",
        body_html_template: "<p>new</p>",
        category: "follow-up",
        tags: ["html"],
        design_preset: "clean-briefing",
        is_system_template: true,
        system_key: "system-meeting-followup-html-v1",
        created_at: "2026-03-20T10:00:00.000Z",
      },
      {
        id: "seeded-old",
        name: "Meeting Booking Follow-up",
        subject_template: "Worth a quick 15-minute chat for {{company}}?",
        body_template: "old body",
        body_html_template: "<p>old</p>",
        category: "follow-up",
        tags: ["html"],
        design_preset: "clean-briefing",
        is_system_template: false,
        system_key: null,
        created_at: "2026-03-19T10:00:00.000Z",
      },
    ]);

    expect(templates).toHaveLength(1);
    expect(templates[0]?.id).toBe("seeded-new");
  });

  it("drops older exact duplicates for saved templates", () => {
    const templates = dedupeTemplates([
      {
        id: "saved-new",
        name: "Custom follow-up",
        subject_template: "Checking in",
        body_template: "Hello there",
        body_html_template: null,
        category: "follow-up",
        tags: ["starter"],
        design_preset: null,
        is_system_template: false,
        system_key: null,
        created_at: "2026-03-20T10:00:00.000Z",
      },
      {
        id: "saved-old",
        name: "Custom follow-up",
        subject_template: "Checking in",
        body_template: "Hello there",
        body_html_template: null,
        category: "follow-up",
        tags: ["starter"],
        design_preset: null,
        is_system_template: false,
        system_key: null,
        created_at: "2026-03-19T10:00:00.000Z",
      },
    ]);

    expect(templates).toHaveLength(1);
    expect(templates[0]?.id).toBe("saved-new");
  });

  it("keeps distinct saved templates even when names overlap", () => {
    const templates = dedupeTemplates([
      {
        id: "saved-a",
        name: "Follow-up note",
        subject_template: "Checking in",
        body_template: "Hello there",
        body_html_template: null,
        category: "follow-up",
        tags: ["starter"],
        design_preset: null,
        is_system_template: false,
        system_key: null,
        created_at: "2026-03-20T10:00:00.000Z",
      },
      {
        id: "saved-b",
        name: "Follow-up note",
        subject_template: "Checking in",
        body_template: "Different body copy",
        body_html_template: null,
        category: "follow-up",
        tags: ["starter"],
        design_preset: null,
        is_system_template: false,
        system_key: null,
        created_at: "2026-03-19T10:00:00.000Z",
      },
    ]);

    expect(templates).toHaveLength(2);
    expect(templates.map((template) => template.id)).toEqual(["saved-a", "saved-b"]);
  });
});
