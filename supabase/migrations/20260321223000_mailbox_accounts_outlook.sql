create table if not exists public.mailbox_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  oauth_connection_id uuid not null references public.oauth_connections(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook')),
  email_address text not null,
  provider_account_label text,
  status text not null default 'active' check (status in ('active', 'paused', 'error')),
  health_status text not null default 'active' check (health_status in ('active', 'needs_reauth', 'disconnected')),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  approved_by_user_id uuid,
  approved_at timestamptz,
  approval_note text,
  daily_send_count integer not null default 0,
  last_sync_cursor text,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, provider, email_address)
);

create index if not exists mailbox_accounts_workspace_status_idx
  on public.mailbox_accounts (workspace_id, provider, status);

drop trigger if exists set_updated_at_mailbox_accounts on public.mailbox_accounts;
create trigger set_updated_at_mailbox_accounts
before update on public.mailbox_accounts
for each row execute function public.set_updated_at();

alter table public.mailbox_accounts enable row level security;

drop policy if exists "workspace members can access mailbox accounts" on public.mailbox_accounts;
create policy "workspace members can access mailbox accounts"
  on public.mailbox_accounts for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace admins can manage mailbox accounts" on public.mailbox_accounts;
create policy "workspace admins can manage mailbox accounts"
  on public.mailbox_accounts for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

insert into public.mailbox_accounts (
  id,
  workspace_id,
  project_id,
  user_id,
  oauth_connection_id,
  provider,
  email_address,
  provider_account_label,
  status,
  health_status,
  approval_status,
  approved_by_user_id,
  approved_at,
  approval_note,
  daily_send_count,
  last_sync_cursor,
  last_synced_at
)
select
  gmail.id,
  gmail.workspace_id,
  gmail.project_id,
  gmail.user_id,
  gmail.oauth_connection_id,
  'gmail',
  gmail.email_address,
  gmail.email_address,
  gmail.status,
  gmail.health_status,
  coalesce(gmail.approval_status, 'approved'),
  gmail.approved_by_user_id,
  coalesce(gmail.approved_at, gmail.created_at),
  gmail.approval_note,
  coalesce(gmail.daily_send_count, 0),
  gmail.last_history_id,
  gmail.last_synced_at
from public.gmail_accounts gmail
on conflict (id) do update
set workspace_id = excluded.workspace_id,
    project_id = excluded.project_id,
    user_id = excluded.user_id,
    oauth_connection_id = excluded.oauth_connection_id,
    provider_account_label = excluded.provider_account_label,
    status = excluded.status,
    health_status = excluded.health_status,
    approval_status = excluded.approval_status,
    approved_by_user_id = excluded.approved_by_user_id,
    approved_at = excluded.approved_at,
    approval_note = excluded.approval_note,
    daily_send_count = excluded.daily_send_count,
    last_sync_cursor = excluded.last_sync_cursor,
    last_synced_at = excluded.last_synced_at;

alter table public.campaigns
  add column if not exists mailbox_account_id uuid references public.mailbox_accounts(id) on delete restrict;

alter table public.message_threads
  add column if not exists mailbox_account_id uuid references public.mailbox_accounts(id) on delete set null,
  add column if not exists provider_thread_id text;

alter table public.thread_messages
  add column if not exists provider_message_id text;

alter table public.message_events
  add column if not exists provider_message_id text;

alter table public.outbound_messages
  add column if not exists provider_message_id text,
  add column if not exists provider_thread_id text;

alter table public.seed_inbox_results
  add column if not exists sender_mailbox_account_id uuid references public.mailbox_accounts(id) on delete set null;

update public.campaigns
set mailbox_account_id = gmail_account_id
where mailbox_account_id is null
  and gmail_account_id is not null;

update public.message_threads target
set mailbox_account_id = campaigns.mailbox_account_id,
    provider_thread_id = coalesce(target.provider_thread_id, target.gmail_thread_id)
from public.campaign_contacts contacts
join public.campaigns campaigns
  on campaigns.id = contacts.campaign_id
where target.campaign_contact_id = contacts.id
  and target.mailbox_account_id is null;

update public.message_threads
set provider_thread_id = coalesce(provider_thread_id, gmail_thread_id)
where provider_thread_id is null
  and gmail_thread_id is not null;

update public.thread_messages
set provider_message_id = coalesce(provider_message_id, gmail_message_id)
where provider_message_id is null
  and gmail_message_id is not null;

update public.message_events
set provider_message_id = coalesce(provider_message_id, gmail_message_id)
where provider_message_id is null
  and gmail_message_id is not null;

update public.outbound_messages
set provider_message_id = coalesce(provider_message_id, gmail_message_id),
    provider_thread_id = coalesce(provider_thread_id, gmail_thread_id)
where provider_message_id is null
   or provider_thread_id is null;

update public.seed_inbox_results
set sender_mailbox_account_id = sender_gmail_account_id
where sender_mailbox_account_id is null
  and sender_gmail_account_id is not null;

create unique index if not exists message_threads_mailbox_provider_thread_unique
  on public.message_threads (mailbox_account_id, provider_thread_id)
  where mailbox_account_id is not null and provider_thread_id is not null;

create unique index if not exists thread_messages_provider_message_unique
  on public.thread_messages (provider_message_id)
  where provider_message_id is not null;

create index if not exists message_events_provider_message_idx
  on public.message_events (provider_message_id)
  where provider_message_id is not null;

create index if not exists outbound_messages_provider_thread_idx
  on public.outbound_messages (provider_thread_id)
  where provider_thread_id is not null;
