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
  const isFinal = stepNumber >= 2;

  return {
    name: stepNumber === 1 ? "Primary email" : `Step ${stepNumber}`,
    waitDays: stepNumber === 1 ? 2 : 0,
    branchCondition: stepNumber === 1 ? "opened" : "time",
    onMatch: isFinal ? "exit_sequence" : "next_step",
    onNoMatch: stepNumber === 1 ? "next_step" : "exit_sequence",
    subject: stepNumber === 1 ? "Quick idea for {{company}}" : "Following up on my note",
    mode: "text",
    body:
      stepNumber === 1
        ? "Hi {{first_name}},\n\nThought this might be relevant for {{company}}.\n\nBest,\nJay"
        : "Hi {{first_name}},\n\nBumping this once in case it got buried.\n\nBest,\nJay",
    bodyHtml: "",
  };
}

export function buildCampaignWizardInitialValues(input: {
  gmailAccounts: Array<{ id: string; email_address: string }>;
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
    gmailAccountId: input.gmailAccounts[0]?.id ?? "",
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
