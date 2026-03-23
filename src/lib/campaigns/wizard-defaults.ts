import type { z } from "zod";
import type { ContactRecord } from "@/lib/types/contact";
import { campaignBuilderSchema } from "@/lib/zod/schemas";

export type CampaignFormValues = z.input<typeof campaignBuilderSchema>;
export type CampaignTemplateOption = {
  id: string;
  name: string;
  subject_template: string;
  body_template: string;
  body_html_template?: string | null;
};

export function buildDefaultWorkflowStep(index: number): CampaignFormValues["workflowDefinition"]["steps"][number] {
  const stepNumber = index + 1;

  if (stepNumber === 1) {
    return {
      name: "Email 1",
      waitDays: 2,
      branchCondition: "time",
      onMatch: "next_step",
      onNoMatch: "next_step",
      subject: "Quick idea for {{company}}",
      mode: "text",
      body:
        "Hi {{first_name}},\n\nI put together a quick idea for {{company}} that could be worth a look.\n\nOpen to a short chat next week?\n\nBest,\nJay",
      bodyHtml: "",
    };
  }

  if (stepNumber === 2) {
    return {
      name: "Follow-up",
      waitDays: 0,
      branchCondition: "time",
      onMatch: "exit_sequence",
      onNoMatch: "exit_sequence",
      subject: "Following up on my note",
      mode: "text",
      body:
        "Hi {{first_name}},\n\nFollowing up in case my last note got buried.\n\nHappy to send over a few ideas tailored to {{company}} if that helps.\n\nBest,\nJay",
      bodyHtml: "",
    };
  }

  return {
    name: `Step ${stepNumber}`,
    waitDays: 2,
    branchCondition: "time",
    onMatch: "exit_sequence",
    onNoMatch: "exit_sequence",
    subject: `Step ${stepNumber} follow-up`,
    mode: "text",
    body:
      "Hi {{first_name}},\n\nWanted to send one last follow-up here.\n\nIf this is not a priority right now, no problem at all.\n\nBest,\nJay",
    bodyHtml: "",
  };
}

export function buildCampaignWizardInitialValues(input: {
  mailboxAccounts: Array<{ id: string; email_address: string }>;
  contacts: ContactRecord[];
  templates: CampaignTemplateOption[];
  selectedTemplateId?: string | null;
}) {
  const firstStep = buildDefaultWorkflowStep(0);
  const secondStep = buildDefaultWorkflowStep(1);
  const selectedTemplate = input.selectedTemplateId
    ? input.templates.find((template) => template.id === input.selectedTemplateId) ?? null
    : null;

  if (selectedTemplate) {
    firstStep.subject = selectedTemplate.subject_template;
    firstStep.body = selectedTemplate.body_template ?? "";
    firstStep.bodyHtml = selectedTemplate.body_html_template ?? "";
    firstStep.mode = selectedTemplate.body_html_template ? "html" : "text";
  }

  return {
    campaignName: "",
    mailboxAccountId: input.mailboxAccounts[0]?.id ?? "",
    contactListId: "",
    targetContactIds: input.contacts.slice(0, 3).map((contact) => contact.id),
    timezone: "Asia/Calcutta",
    sendWindowStart: "09:00",
    sendWindowEnd: "17:00",
    dailySendLimit: 25,
    workflowDefinition: {
      steps: [firstStep, secondStep],
    },
  } satisfies CampaignFormValues;
}
