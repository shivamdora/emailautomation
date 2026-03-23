create table if not exists public.campaign_send_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_contact_id uuid not null references public.campaign_contacts(id) on delete cascade,
  step_number integer not null check (step_number between 1 and 5),
  scheduled_for timestamptz not null,
  reserved_at timestamptz,
  processed_at timestamptz,
  canceled_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'reserved', 'sent', 'failed', 'canceled')),
  attempt_count integer not null default 0,
  last_error text,
  reservation_token uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (campaign_contact_id, step_number)
);

create index if not exists campaign_send_jobs_due_idx
  on public.campaign_send_jobs (status, scheduled_for);

create index if not exists campaign_send_jobs_campaign_status_idx
  on public.campaign_send_jobs (campaign_id, status, scheduled_for);

create table if not exists public.campaign_queue_runs (
  id uuid primary key default gen_random_uuid(),
  worker_name text not null,
  status text not null check (status in ('success', 'partial', 'error')),
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  processed_count integer not null default 0,
  error_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists campaign_queue_runs_worker_finished_idx
  on public.campaign_queue_runs (worker_name, finished_at desc);

drop trigger if exists set_updated_at_campaign_send_jobs on public.campaign_send_jobs;
create trigger set_updated_at_campaign_send_jobs
before update on public.campaign_send_jobs
for each row execute procedure public.set_updated_at();

alter table public.campaign_send_jobs enable row level security;

create policy "workspace members can access campaign send jobs"
  on public.campaign_send_jobs for all
  using (
    exists (
      select 1
      from public.campaigns c
      where c.id = campaign_send_jobs.campaign_id
        and public.is_workspace_member(c.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.campaigns c
      where c.id = campaign_send_jobs.campaign_id
        and public.is_workspace_member(c.workspace_id)
    )
  );

create or replace function public.reserve_campaign_send_jobs(
  p_limit integer default 25,
  p_campaign_id uuid default null,
  p_now timestamptz default timezone('utc', now()),
  p_reservation_token uuid default gen_random_uuid()
)
returns setof public.campaign_send_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select jobs.id
    from public.campaign_send_jobs jobs
    where (
        jobs.status = 'pending'
        or (jobs.status = 'reserved' and jobs.reserved_at <= p_now - interval '15 minutes')
      )
      and jobs.scheduled_for <= p_now
      and (p_campaign_id is null or jobs.campaign_id = p_campaign_id)
    order by jobs.scheduled_for asc
    limit greatest(coalesce(p_limit, 25), 1)
    for update skip locked
  ),
  updated as (
    update public.campaign_send_jobs jobs
    set status = 'reserved',
        reserved_at = p_now,
        reservation_token = p_reservation_token,
        updated_at = p_now
    where jobs.id in (select id from candidates)
    returning jobs.*
  )
  select *
  from updated
  order by scheduled_for asc;
end;
$$;

with queue_backfill as (
  select
    campaigns.workspace_id,
    campaigns.project_id,
    campaign_contacts.campaign_id,
    campaign_contacts.id as campaign_contact_id,
    case
      when campaign_contacts.status = 'queued' then greatest(campaign_contacts.current_step, 1)
      when campaign_contacts.status = 'followup_due' then greatest(campaign_contacts.current_step, 2)
      when campaign_contacts.status = 'sent' then coalesce(sent_messages.max_step_number, 0) + 1
      else null
    end as step_number,
    coalesce(campaign_contacts.next_due_at, timezone('utc', now())) as scheduled_for,
    coalesce(defined_steps.max_step_number, 0) as max_step_number
  from public.campaign_contacts
  join public.campaigns on campaigns.id = campaign_contacts.campaign_id
  left join lateral (
    select max(step_number) as max_step_number
    from public.outbound_messages
    where campaign_contact_id = campaign_contacts.id
  ) sent_messages on true
  left join lateral (
    select max(step_number) as max_step_number
    from public.campaign_steps
    where campaign_id = campaign_contacts.campaign_id
  ) defined_steps on true
  where campaigns.status = 'active'
    and campaign_contacts.status in ('queued', 'followup_due', 'sent')
)
insert into public.campaign_send_jobs (
  workspace_id,
  project_id,
  campaign_id,
  campaign_contact_id,
  step_number,
  scheduled_for,
  status
)
select
  workspace_id,
  project_id,
  campaign_id,
  campaign_contact_id,
  step_number,
  scheduled_for,
  'pending'
from queue_backfill
where step_number is not null
  and step_number <= max_step_number
on conflict (campaign_contact_id, step_number) do nothing;
