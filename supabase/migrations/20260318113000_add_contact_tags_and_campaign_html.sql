create table if not exists public.contact_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists contact_tags_workspace_name_unique
  on public.contact_tags (workspace_id, lower(name));

create table if not exists public.contact_tag_members (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tag_id uuid not null references public.contact_tags(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (contact_id, tag_id)
);

create index if not exists contact_tag_members_contact_idx
  on public.contact_tag_members (contact_id);

create index if not exists contact_tag_members_tag_idx
  on public.contact_tag_members (tag_id);

alter table public.campaign_steps
  add column if not exists body_html_template text;
