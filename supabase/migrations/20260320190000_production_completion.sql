alter table public.crm_connections
  add column if not exists auth_type text not null default 'api_key' check (auth_type in ('api_key', 'oauth')),
  add column if not exists provider_account_id text,
  add column if not exists provider_account_email text,
  add column if not exists access_token_encrypted text,
  add column if not exists refresh_token_encrypted text,
  add column if not exists token_expiry timestamptz,
  add column if not exists inbound_api_key_hash text,
  add column if not exists inbound_api_key_hint text,
  add column if not exists inbound_api_key_last_rotated_at timestamptz,
  add column if not exists outbound_webhook_url text,
  add column if not exists webhook_signing_secret_encrypted text,
  add column if not exists connection_metadata_jsonb jsonb not null default '{}'::jsonb,
  add column if not exists sync_frequency_minutes integer not null default 30,
  add column if not exists last_error text,
  add column if not exists last_writeback_at timestamptz,
  add column if not exists last_synced_scope text[] not null default '{}'::text[];

create unique index if not exists crm_connections_inbound_api_key_hash_idx
  on public.crm_connections (inbound_api_key_hash)
  where inbound_api_key_hash is not null;

create table if not exists public.crm_push_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  crm_connection_id uuid not null references public.crm_connections(id) on delete cascade,
  job_type text not null default 'activity_writeback' check (job_type in ('activity_writeback', 'contact_status_sync')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'canceled')),
  payload_jsonb jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default timezone('utc', now()),
  last_attempt_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists crm_push_jobs_workspace_status_idx
  on public.crm_push_jobs (workspace_id, status, next_attempt_at);

create trigger set_updated_at_crm_push_jobs before update on public.crm_push_jobs
for each row execute function public.set_updated_at();

alter table public.seed_inboxes
  add column if not exists oauth_connection_id uuid references public.oauth_connections(id) on delete set null,
  add column if not exists connection_status text not null default 'pending' check (connection_status in ('pending', 'connected', 'needs_reauth', 'disconnected')),
  add column if not exists health_status text not null default 'pending' check (health_status in ('pending', 'healthy', 'warning', 'error')),
  add column if not exists monitor_metadata_jsonb jsonb not null default '{}'::jsonb,
  add column if not exists monitoring_enabled boolean not null default true,
  add column if not exists reconnect_required boolean not null default false,
  add column if not exists last_probe_at timestamptz,
  add column if not exists last_result_status text check (last_result_status in ('primary', 'promotions', 'updates', 'spam', 'junk', 'missing'));

create table if not exists public.seed_probe_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  seed_inbox_id uuid not null references public.seed_inboxes(id) on delete cascade,
  sender_gmail_account_id uuid not null references public.gmail_accounts(id) on delete cascade,
  probe_key text not null,
  subject text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'observed', 'failed')),
  sent_at timestamptz,
  observed_at timestamptz,
  last_error text,
  payload_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, probe_key)
);

create index if not exists seed_probe_jobs_workspace_status_idx
  on public.seed_probe_jobs (workspace_id, status, created_at desc);

create trigger set_updated_at_seed_probe_jobs before update on public.seed_probe_jobs
for each row execute function public.set_updated_at();

alter table public.seed_inbox_results
  add column if not exists sender_gmail_account_id uuid references public.gmail_accounts(id) on delete set null,
  add column if not exists probe_subject text,
  add column if not exists gmail_message_id text;

alter table public.plan_limits
  add column if not exists crm_connectors_limit integer not null default 1,
  add column if not exists seed_inboxes_limit integer not null default 1,
  add column if not exists monthly_sends_limit integer not null default 1000;

alter table public.workspace_usage_counters
  add column if not exists crm_connections_count integer not null default 0,
  add column if not exists seed_inboxes_count integer not null default 0,
  add column if not exists monthly_sends_used integer not null default 0;

alter table public.workspace_billing_accounts
  add column if not exists billing_anchor_at timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists reactivated_at timestamptz,
  add column if not exists current_period_start date,
  add column if not exists current_period_end date,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists latest_invoice_status text,
  add column if not exists billing_metadata_jsonb jsonb not null default '{}'::jsonb;

create table if not exists public.workspace_billing_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid,
  event_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists workspace_billing_events_workspace_idx
  on public.workspace_billing_events (workspace_id, created_at desc);

create table if not exists public.workspace_billing_invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  billing_account_id uuid not null references public.workspace_billing_accounts(id) on delete cascade,
  invoice_number text not null,
  status text not null default 'open' check (status in ('draft', 'open', 'paid', 'void')),
  plan_key text not null,
  period_start date not null,
  period_end date not null,
  usage_snapshot_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, invoice_number)
);

create index if not exists workspace_billing_invoices_workspace_idx
  on public.workspace_billing_invoices (workspace_id, created_at desc);

create trigger set_updated_at_workspace_billing_invoices before update on public.workspace_billing_invoices
for each row execute function public.set_updated_at();

alter table public.templates
  add column if not exists system_key text,
  add column if not exists is_system_template boolean not null default false,
  add column if not exists seed_version integer not null default 1;

create unique index if not exists templates_workspace_system_key_idx
  on public.templates (workspace_id, system_key);

insert into public.plan_limits (
  plan_key,
  connected_mailboxes_limit,
  daily_sends_limit,
  active_campaigns_limit,
  seats_limit,
  crm_sync_enabled,
  crm_connectors_limit,
  seed_inboxes_limit,
  monthly_sends_limit
)
values ('internal_mvp', 5, 250, 25, 15, true, 3, 10, 5000)
on conflict (plan_key) do update
set connected_mailboxes_limit = excluded.connected_mailboxes_limit,
    daily_sends_limit = excluded.daily_sends_limit,
    active_campaigns_limit = excluded.active_campaigns_limit,
    seats_limit = excluded.seats_limit,
    crm_sync_enabled = excluded.crm_sync_enabled,
    crm_connectors_limit = excluded.crm_connectors_limit,
    seed_inboxes_limit = excluded.seed_inboxes_limit,
    monthly_sends_limit = excluded.monthly_sends_limit;

alter table public.crm_push_jobs enable row level security;
alter table public.seed_probe_jobs enable row level security;
alter table public.workspace_billing_events enable row level security;
alter table public.workspace_billing_invoices enable row level security;

drop policy if exists "workspace admins can manage crm push jobs" on public.crm_push_jobs;
create policy "workspace admins can manage crm push jobs"
  on public.crm_push_jobs for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace members can read crm push jobs" on public.crm_push_jobs;
create policy "workspace members can read crm push jobs"
  on public.crm_push_jobs for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace admins can manage seed probe jobs" on public.seed_probe_jobs;
create policy "workspace admins can manage seed probe jobs"
  on public.seed_probe_jobs for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace members can read seed probe jobs" on public.seed_probe_jobs;
create policy "workspace members can read seed probe jobs"
  on public.seed_probe_jobs for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace admins can manage billing events" on public.workspace_billing_events;
create policy "workspace admins can manage billing events"
  on public.workspace_billing_events for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace admins can manage billing invoices" on public.workspace_billing_invoices;
create policy "workspace admins can manage billing invoices"
  on public.workspace_billing_invoices for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace members can read billing events" on public.workspace_billing_events;
create policy "workspace members can read billing events"
  on public.workspace_billing_events for select
  using (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace members can read billing invoices" on public.workspace_billing_invoices;
create policy "workspace members can read billing invoices"
  on public.workspace_billing_invoices for select
  using (public.is_workspace_admin(workspace_id));

notify pgrst, 'reload schema';
