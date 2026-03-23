create index if not exists workspace_members_user_created_idx
  on public.workspace_members (user_id, created_at desc);

create index if not exists campaigns_workspace_project_created_idx
  on public.campaigns (workspace_id, project_id, created_at desc);

create index if not exists contacts_workspace_project_created_idx
  on public.contacts (workspace_id, project_id, created_at desc);

create index if not exists imports_workspace_project_created_idx
  on public.imports (workspace_id, project_id, created_at desc);

create index if not exists message_threads_workspace_project_latest_idx
  on public.message_threads (workspace_id, project_id, latest_message_at desc nulls last);

create index if not exists campaign_contacts_campaign_status_idx
  on public.campaign_contacts (campaign_id, status);

create or replace function public.get_workspace_project_metrics(p_workspace_id uuid)
returns table (
  project_id uuid,
  total_leads bigint,
  queued bigint,
  sent bigint,
  followup_sent bigint,
  replied bigint,
  unsubscribed bigint,
  failed bigint,
  reply_rate numeric
)
language sql
stable
as $$
  with workspace_projects as (
    select p.id
    from public.projects p
    where p.workspace_id = p_workspace_id
  ),
  contact_totals as (
    select
      c.project_id,
      count(*)::bigint as total_leads,
      count(*) filter (where c.unsubscribed_at is not null)::bigint as unsubscribed
    from public.contacts c
    where c.workspace_id = p_workspace_id
    group by c.project_id
  ),
  campaign_contact_totals as (
    select
      campaigns.project_id,
      count(*) filter (where campaign_contacts.status = 'queued')::bigint as queued,
      count(*) filter (where campaign_contacts.status = 'replied')::bigint as replied,
      count(*) filter (where campaign_contacts.status = 'failed')::bigint as failed
    from public.campaign_contacts
    join public.campaigns on campaigns.id = campaign_contacts.campaign_id
    where campaigns.workspace_id = p_workspace_id
    group by campaigns.project_id
  ),
  outbound_totals as (
    select
      campaigns.project_id,
      count(*) filter (
        where outbound_messages.status = 'sent'
          and outbound_messages.step_number = 1
      )::bigint as sent,
      count(*) filter (
        where outbound_messages.status = 'sent'
          and outbound_messages.step_number = 2
      )::bigint as followup_sent
    from public.outbound_messages
    join public.campaign_contacts on campaign_contacts.id = outbound_messages.campaign_contact_id
    join public.campaigns on campaigns.id = campaign_contacts.campaign_id
    where campaigns.workspace_id = p_workspace_id
    group by campaigns.project_id
  )
  select
    workspace_projects.id as project_id,
    coalesce(contact_totals.total_leads, 0) as total_leads,
    coalesce(campaign_contact_totals.queued, 0) as queued,
    coalesce(outbound_totals.sent, 0) as sent,
    coalesce(outbound_totals.followup_sent, 0) as followup_sent,
    coalesce(campaign_contact_totals.replied, 0) as replied,
    coalesce(contact_totals.unsubscribed, 0) as unsubscribed,
    coalesce(campaign_contact_totals.failed, 0) as failed,
    case
      when coalesce(outbound_totals.sent, 0) > 0
        then round((coalesce(campaign_contact_totals.replied, 0)::numeric * 100.0) / outbound_totals.sent, 1)
      else 0
    end as reply_rate
  from workspace_projects
  left join contact_totals on contact_totals.project_id = workspace_projects.id
  left join campaign_contact_totals on campaign_contact_totals.project_id = workspace_projects.id
  left join outbound_totals on outbound_totals.project_id = workspace_projects.id
  order by workspace_projects.id;
$$;

notify pgrst, 'reload schema';
