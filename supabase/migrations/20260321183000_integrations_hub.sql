create table if not exists public.workspace_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('slack', 'webhook', 'hunter', 'calendly')),
  auth_type text not null check (auth_type in ('oauth', 'api_key', 'webhook')),
  status text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  provider_account_id text,
  provider_account_label text,
  provider_account_email text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expiry timestamptz,
  api_key_encrypted text,
  api_key_hint text,
  signing_secret_encrypted text,
  signing_secret_hint text,
  config_jsonb jsonb not null default '{}'::jsonb,
  last_event_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, provider)
);

create index if not exists workspace_integrations_workspace_status_idx
  on public.workspace_integrations (workspace_id, status, provider);

create trigger set_updated_at_workspace_integrations before update on public.workspace_integrations
for each row execute function public.set_updated_at();

alter table public.workspace_integrations enable row level security;

drop policy if exists "workspace members can read workspace integrations" on public.workspace_integrations;
create policy "workspace members can read workspace integrations"
  on public.workspace_integrations for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace admins can manage workspace integrations" on public.workspace_integrations;
create policy "workspace admins can manage workspace integrations"
  on public.workspace_integrations for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

notify pgrst, 'reload schema';
