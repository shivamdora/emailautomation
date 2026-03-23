import { describe, expect, it } from "vitest";
import { buildCampaignWizardInitialValues } from "@/lib/campaigns/wizard-defaults";

describe("buildCampaignWizardInitialValues", () => {
  it("loads the selected template into the first workflow step", () => {
    const values = buildCampaignWizardInitialValues({
      mailboxAccounts: [{ id: "mailbox-1", email_address: "jayant@example.com" }],
      contacts: [
        {
          id: "contact-1",
          email: "lead@example.com",
          first_name: "Ava",
          last_name: null,
          company: "Northstar",
          website: null,
          job_title: null,
          custom_fields_jsonb: null,
          unsubscribed_at: null,
          tags: [],
        },
      ],
      templates: [
        {
          id: "template-1",
          name: "Meeting Booking Follow-up",
          subject_template: "Worth a quick 15-minute chat for {{company}}?",
          body_template: "Fallback text",
          body_html_template: "<p>HTML body</p>",
        },
      ],
      selectedTemplateId: "template-1",
    });

    expect(values.workflowDefinition.steps[0]).toMatchObject({
      subject: "Worth a quick 15-minute chat for {{company}}?",
      body: "Fallback text",
      bodyHtml: "<p>HTML body</p>",
      mode: "html",
    });
  });
});
