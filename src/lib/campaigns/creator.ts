import type { WorkflowStepInput } from "@/lib/workflows/definition";

export const campaignCreatorSteps = [
  { id: "start", label: "Start" },
  { id: "audience", label: "Audience" },
  { id: "message", label: "Message" },
  { id: "review", label: "Review & launch" },
] as const;

export type CampaignCreatorStepId = (typeof campaignCreatorSteps)[number]["id"];

export const sendWindowPresets = [
  { id: "business-hours", label: "Business hours", start: "09:00", end: "17:00" },
  { id: "morning", label: "Morning", start: "08:00", end: "12:00" },
  { id: "afternoon", label: "Afternoon", start: "13:00", end: "18:00" },
  { id: "custom", label: "Custom", start: "", end: "" },
] as const;

export type SendWindowPresetId = (typeof sendWindowPresets)[number]["id"];

export type LaunchChecklistItem = {
  id: "sender" | "contacts" | "primary" | "followup";
  label: string;
  complete: boolean;
};

const DEFAULT_FIRST_STEP = {
  waitDays: 2,
  branchCondition: "time",
  onMatch: "next_step",
  onNoMatch: "next_step",
} as const;

const DEFAULT_FOLLOWUP_STEP = {
  waitDays: 0,
  branchCondition: "time",
  onMatch: "exit_sequence",
  onNoMatch: "exit_sequence",
} as const;

function normalizeValue(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function isStepBodyComplete(step: WorkflowStepInput | null | undefined) {
  if (!step) {
    return false;
  }

  if (step.mode === "html") {
    return normalizeValue(step.bodyHtml).length >= 10;
  }

  return normalizeValue(step.body).length >= 10;
}

export function isAdvancedWorkflow(
  steps: Array<WorkflowStepInput | null | undefined> | null | undefined,
) {
  const normalizedSteps = (steps ?? []).filter(Boolean) as WorkflowStepInput[];

  if (normalizedSteps.length !== 2) {
    return normalizedSteps.length > 0;
  }

  const [firstStep, followUpStep] = normalizedSteps;

  return (
    Number(firstStep.waitDays ?? DEFAULT_FIRST_STEP.waitDays) !== DEFAULT_FIRST_STEP.waitDays ||
    (firstStep.branchCondition ?? DEFAULT_FIRST_STEP.branchCondition) !==
      DEFAULT_FIRST_STEP.branchCondition ||
    (firstStep.onMatch ?? DEFAULT_FIRST_STEP.onMatch) !== DEFAULT_FIRST_STEP.onMatch ||
    (firstStep.onNoMatch ?? DEFAULT_FIRST_STEP.onNoMatch) !== DEFAULT_FIRST_STEP.onNoMatch ||
    Number(followUpStep.waitDays ?? DEFAULT_FOLLOWUP_STEP.waitDays) !==
      DEFAULT_FOLLOWUP_STEP.waitDays ||
    (followUpStep.branchCondition ?? DEFAULT_FOLLOWUP_STEP.branchCondition) !==
      DEFAULT_FOLLOWUP_STEP.branchCondition ||
    (followUpStep.onMatch ?? DEFAULT_FOLLOWUP_STEP.onMatch) !== DEFAULT_FOLLOWUP_STEP.onMatch ||
    (followUpStep.onNoMatch ?? DEFAULT_FOLLOWUP_STEP.onNoMatch) !==
      DEFAULT_FOLLOWUP_STEP.onNoMatch
  );
}

export function describeWorkflowRoute(step: WorkflowStepInput | null | undefined) {
  if (!step) {
    return "Step details unavailable.";
  }

  const waitDays = Number(step.waitDays ?? 0);
  const waitLabel = waitDays === 0 ? "Sends immediately after the previous step." : `Waits ${waitDays} day${waitDays === 1 ? "" : "s"} before checking.`;

  if ((step.branchCondition ?? "time") === "time") {
    return `${waitLabel} Then ${step.onMatch === "exit_sequence" ? "stop the sequence." : "continue to the next step."}`;
  }

  const branchLabel =
    step.branchCondition === "opened" ? "opens the email" : "clicks a tracked link";

  return `${waitLabel} If the contact ${branchLabel}, ${step.onMatch === "exit_sequence" ? "stop the sequence" : "continue to the next step"}. Otherwise, ${step.onNoMatch === "exit_sequence" ? "stop the sequence." : "continue to the next step."}`;
}

export function getSendWindowPresetId(
  start: string | null | undefined,
  end: string | null | undefined,
): SendWindowPresetId {
  const matchedPreset = sendWindowPresets.find(
    (preset) => preset.id !== "custom" && preset.start === start && preset.end === end,
  );

  return matchedPreset?.id ?? "custom";
}

export function formatSendWindowSummary(
  timezone: string | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
) {
  const resolvedTimezone = normalizeValue(timezone) || "Timezone not set";
  const resolvedStart = normalizeValue(start) || "--:--";
  const resolvedEnd = normalizeValue(end) || "--:--";

  return `${resolvedStart} - ${resolvedEnd} (${resolvedTimezone})`;
}

export function buildLaunchChecklist(input: {
  hasSender: boolean;
  selectedContactsCount: number;
  primaryStep?: WorkflowStepInput | null;
  followUpStep?: WorkflowStepInput | null;
}) {
  const primaryStep = input.primaryStep ?? null;
  const followUpStep = input.followUpStep ?? null;

  return [
    {
      id: "sender",
      label: "Sender connected",
      complete: input.hasSender,
    },
    {
      id: "contacts",
      label: "Audience selected",
      complete: input.selectedContactsCount > 0,
    },
    {
      id: "primary",
      label: "Primary email complete",
      complete:
        normalizeValue(primaryStep?.subject).length >= 3 && isStepBodyComplete(primaryStep),
    },
    {
      id: "followup",
      label: "Follow-up complete",
      complete:
        normalizeValue(followUpStep?.subject).length >= 3 && isStepBodyComplete(followUpStep),
    },
  ] satisfies LaunchChecklistItem[];
}
