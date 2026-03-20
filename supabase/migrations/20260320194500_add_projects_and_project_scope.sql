create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  website text,
  logo_url text,
  brand_name text,
  sender_display_name text,
  sender_title text,
  sender_signature text,
  created_by_user_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, slug)
);

create index if not exists projects_workspace_idx
  on public.projects (workspace_id, created_at desc);

create trigger set_updated_at_projects before update on public.projects
for each row execute function public.set_updated_at();

alter table public.workspace_members
  add column if not exists last_active_project_id uuid references public.projects(id) on delete set null;

alter table public.oauth_connections
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.gmail_accounts
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.contacts
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.contact_lists
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.contact_tags
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.imports
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.templates
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.campaigns
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.message_threads
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.crm_connections
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.seed_inboxes
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

with ranked_members as (
  select
    wm.workspace_id,
    wm.user_id,
    row_number() over (
      partition by wm.workspace_id
      order by
        case wm.role
          when 'owner' then 0
          when 'admin' then 1
          else 2
        end,
        wm.created_at,
        wm.id
    ) as rank_in_workspace
  from public.workspace_members wm
)
insert into public.projects (
  workspace_id,
  name,
  slug,
  brand_name,
  sender_display_name,
  created_by_user_id
)
select
  ranked_members.workspace_id,
  'Main Project',
  'main-project',
  w.name,
  null,
  ranked_members.user_id
from ranked_members
join public.workspaces w on w.id = ranked_members.workspace_id
where ranked_members.rank_in_workspace = 1
on conflict (workspace_id, slug) do nothing;

update public.workspace_members wm
set last_active_project_id = projects.id
from public.projects
where projects.workspace_id = wm.workspace_id
  and projects.slug = 'main-project'
  and wm.last_active_project_id is null;

update public.oauth_connections target
set project_id = projects.id
from public.projects
where projects.workspace_id = target.workspace_id
  and projects.slug = 'main-project'
  and target.project_id is null;

update public.gmail_accounts target
set project_id = projects.id
from public.projects
where projects.workspace_id = target.workspace_id
  and projects.slug = 'main-project'
  and target.project_id is null;

update public.contacts target
set project_id = projects.id
from public.projects
where projects.workspace_id = target.workspace_id
  and projects.slug = 'main-project'
  and target.project_id is null;

update public.contact_lists target
set project_id = projects.id
from public.projects
where projects.workspace_id = target.workspace_id
  and projects.slug = 'main-project'
  and target.project_id is null;

update public.contact_tags target
set project_id = projects.id
from public.projects
where projects.workspace_id = target.workspace_id
  and projects.slug = 'main-project'
  and target.project_id is null;

update public.imports target
set project_id = projects.id
from public.projects
where projects.workspace_id = target.workspace_id
  and projects.slug = 'main-project'
  and target.project_id is null;

update public.templates target
set project_id = projects.id
from public.projects
where projects.workspace_id = target.workspace_id
  and projects.slug = 'main-project'
  and target.project_id is null;

update public.campaigns target
set project_id = projects.id
from public.projects
where projects.workspace_id = target.workspace_id
  and projects.slug = 'main-project'
  and target.project_id is null;

update public.message_threads target
set project_id = projects.id
from public.projects
where projects.workspace_id = target.workspace_id
  and projects.slug = 'main-project'
  and target.project_id is null;

update public.crm_connections target
set project_id = projects.id
from public.projects
where projects.workspace_id = target.workspace_id
  and projects.slug = 'main-project'
  and target.project_id is null;

update public.seed_inboxes target
set project_id = projects.id
from public.projects
where projects.workspace_id = target.workspace_id
  and projects.slug = 'main-project'
  and target.project_id is null;

alter table public.oauth_connections
  alter column project_id set not null;

alter table public.gmail_accounts
  alter column project_id set not null;

alter table public.contacts
  alter column project_id set not null;

alter table public.contact_lists
  alter column project_id set not null;

alter table public.contact_tags
  alter column project_id set not null;

alter table public.imports
  alter column project_id set not null;

alter table public.templates
  alter column project_id set not null;

alter table public.campaigns
  alter column project_id set not null;

alter table public.message_threads
  alter column project_id set not null;

alter table public.crm_connections
  alter column project_id set not null;

alter table public.seed_inboxes
  alter column project_id set not null;

alter table public.oauth_connections
  drop constraint if exists oauth_connections_workspace_id_provider_email_address_key;

alter table public.gmail_accounts
  drop constraint if exists gmail_accounts_workspace_id_email_address_key;

alter table public.contacts
  drop constraint if exists contacts_workspace_id_external_source_external_contact_id_key;

drop index if exists public.contacts_workspace_email_unique;
drop index if exists public.contact_tags_workspace_name_unique;
drop index if exists public.templates_workspace_system_key_idx;

create unique index if not exists oauth_connections_project_provider_email_unique
  on public.oauth_connections (project_id, provider, email_address);

create unique index if not exists gmail_accounts_project_email_unique
  on public.gmail_accounts (project_id, email_address);

create unique index if not exists contacts_project_email_unique
  on public.contacts (project_id, lower(email));

create unique index if not exists contacts_project_external_unique
  on public.contacts (project_id, external_source, external_contact_id)
  where external_source is not null and external_contact_id is not null;

create unique index if not exists contact_tags_project_name_unique
  on public.contact_tags (project_id, lower(name));

create unique index if not exists templates_project_system_key_idx
  on public.templates (project_id, system_key)
  where system_key is not null;

create unique index if not exists seed_inboxes_project_email_unique
  on public.seed_inboxes (project_id, email_address);

insert into storage.buckets (id, name, public)
values ('project-assets', 'project-assets', true)
on conflict (id) do nothing;

alter table public.projects enable row level security;

drop policy if exists "workspace members can access projects" on public.projects;
create policy "workspace members can access projects"
  on public.projects for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "authenticated users can upload project assets" on storage.objects;
create policy "authenticated users can upload project assets"
  on storage.objects for insert
  with check (
    bucket_id = 'project-assets'
    and auth.role() = 'authenticated'
  );

drop policy if exists "authenticated users can update project assets" on storage.objects;
create policy "authenticated users can update project assets"
  on storage.objects for update
  using (
    bucket_id = 'project-assets'
    and auth.role() = 'authenticated'
  )
  with check (
    bucket_id = 'project-assets'
    and auth.role() = 'authenticated'
  );

drop policy if exists "anyone can read project assets" on storage.objects;
create policy "anyone can read project assets"
  on storage.objects for select
  using (bucket_id = 'project-assets');

notify pgrst, 'reload schema';
