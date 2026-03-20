export type KnownDefaultTemplate = {
  systemKey: string;
  name: string;
  subjectTemplate: string;
  category: "launch" | "follow-up";
};

export const SHELTER_SCORE_SYSTEM_KEY = "system-shelter-score-launch-html-v1";
export const MEETING_FOLLOW_UP_SYSTEM_KEY = "system-meeting-followup-html-v1";

export const KNOWN_DEFAULT_TEMPLATES: KnownDefaultTemplate[] = [
  {
    systemKey: SHELTER_SCORE_SYSTEM_KEY,
    name: "Shelter Score Launch Template",
    subjectTemplate: "ShelterScore for Trusted Building Companies",
    category: "launch",
  },
  {
    systemKey: MEETING_FOLLOW_UP_SYSTEM_KEY,
    name: "Meeting Booking Follow-up",
    subjectTemplate: "Worth a quick 15-minute chat for {{company}}?",
    category: "follow-up",
  },
];

export const FEATURED_TEMPLATE_SYSTEM_KEYS = [
  SHELTER_SCORE_SYSTEM_KEY,
  MEETING_FOLLOW_UP_SYSTEM_KEY,
] as const;

export function resolveKnownDefaultTemplate(input: {
  system_key?: string | null;
  name?: string | null;
  subject_template?: string | null;
}) {
  if (input.system_key) {
    const matchedBySystemKey = KNOWN_DEFAULT_TEMPLATES.find(
      (template) => template.systemKey === input.system_key,
    );

    if (matchedBySystemKey) {
      return matchedBySystemKey;
    }
  }

  if (!input.name || !input.subject_template) {
    return null;
  }

  return (
    KNOWN_DEFAULT_TEMPLATES.find(
      (template) =>
        template.name === input.name &&
        template.subjectTemplate === input.subject_template,
    ) ?? null
  );
}

export function resolveCanonicalTemplateSystemKey(input: {
  system_key?: string | null;
  name?: string | null;
  subject_template?: string | null;
}) {
  return resolveKnownDefaultTemplate(input)?.systemKey ?? input.system_key ?? null;
}
