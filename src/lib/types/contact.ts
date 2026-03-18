export type ContactTag = {
  id: string;
  name: string;
};

export type ContactRecord = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  website?: string | null;
  job_title?: string | null;
  source?: string | null;
  unsubscribed_at?: string | null;
  custom_fields_jsonb?: Record<string, unknown> | null;
  tags?: ContactTag[];
};
