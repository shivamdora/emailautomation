# Supabase Setup

## Project services used

- Auth
- Postgres
- Storage
- Edge Functions
- Cron

## Apply schema

Apply migrations in order:

1. [supabase/migrations/20260310235900_init_outboundflow.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260310235900_init_outboundflow.sql)
2. [supabase/migrations/20260316181500_add_profile_onboarding_completion.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260316181500_add_profile_onboarding_completion.sql)
3. [supabase/migrations/20260318113000_add_contact_tags_and_campaign_html.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260318113000_add_contact_tags_and_campaign_html.sql)
4. [supabase/migrations/20260318170000_add_html_templates.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260318170000_add_html_templates.sql)
5. [supabase/migrations/20260320154500_launch_foundations.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260320154500_launch_foundations.sql)
6. [supabase/migrations/20260320190000_production_completion.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260320190000_production_completion.sql)
7. [supabase/migrations/20260320194500_add_projects_and_project_scope.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260320194500_add_projects_and_project_scope.sql)
8. [supabase/migrations/20260321103000_campaign_send_queue.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260321103000_campaign_send_queue.sql)
9. [supabase/migrations/20260321183000_integrations_hub.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260321183000_integrations_hub.sql)
10. [supabase/migrations/20260321200000_redis_cache_performance.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260321200000_redis_cache_performance.sql)
11. [supabase/migrations/20260321223000_mailbox_accounts_outlook.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260321223000_mailbox_accounts_outlook.sql)

If your network does not support IPv6, use the Session pooler connection string from Supabase Dashboard -> Connect instead of the direct `db.<project-ref>.supabase.co` host when running `supabase db push`.

After applying migrations that add new public tables or RPC functions, refresh PostgREST's schema cache in the Supabase SQL Editor:

```sql
NOTIFY pgrst, 'reload schema';
```

If PostgREST still does not recognize the new schema, run this once in the SQL Editor and then retry:

```sql
select pg_notification_queue_usage();
```

Recent migrations add:

- CRM auth and writeback columns on `crm_connections`
- `crm_push_jobs`
- `workspace_billing_events`
- `workspace_billing_invoices`
- expanded `plan_limits` and `workspace_usage_counters`
- `campaign_send_jobs`
- `campaign_queue_runs`
- `reserve_campaign_send_jobs`
- `mailbox_accounts` with Outlook support
- seed monitor OAuth fields on `seed_inboxes`
- `seed_probe_jobs`
- system template keys for idempotent HTML template seeding

## Storage

Expected bucket:

- `imports`

## Edge Functions

Deploy:

- `supabase/functions/send-due-messages`
- `supabase/functions/sync-replies`
- `supabase/functions/crm-sync`
- `supabase/functions/seed-monitor`

Required secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `TOKEN_ENCRYPTION_KEY`
- `SUPABASE_CRON_VERIFY_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `HUBSPOT_CLIENT_ID`
- `HUBSPOT_CLIENT_SECRET`
- `SALESFORCE_CLIENT_ID`
- `SALESFORCE_CLIENT_SECRET`
- `SALESFORCE_AUTH_BASE_URL`
- `SEED_MONITOR_INTERVAL_MINUTES`

## Cron schedule

- Every 1 minute: `send-due-messages`
- Every 1 minute: `sync-replies`
- Every 15 minutes: `crm-sync`
- Every `SEED_MONITOR_INTERVAL_MINUTES`: `seed-monitor`

Pass `x-cron-secret: <SUPABASE_CRON_VERIFY_SECRET>` in each scheduled invocation.
`send-due-messages` is the authoritative campaign queue worker. Step 1 and follow-up timing are both driven from this 1-minute cadence.

## Google sign-in via Supabase

App login with the Google sign-in button uses Supabase Auth, not the custom Gmail mailbox OAuth route.

The Google Cloud OAuth client configured in Supabase must include:

- `https://<your-project-ref>.supabase.co/auth/v1/callback`

And Supabase Auth itself must allow:

- `http://localhost:3000/auth/callback`
- your deployed app callback URL

## Gmail OAuth

OutboundFlow uses a separate Google OAuth client for mailbox connect and seed-monitor connect under:

- `/api/gmail/callback`
- `/api/settings/seed-inboxes/callback`

Recommended scopes:

- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.modify`

## CRM OAuth

HubSpot:

- redirect URI: `http://localhost:3000/api/crm/callback/hubspot`

Salesforce:

- redirect URI: `http://localhost:3000/api/crm/callback/salesforce`
- auth base URL defaults to `https://login.salesforce.com`

## Seed monitor notes

- Seed placement is exact only for owned monitored inboxes, not for every real recipient.
- Gmail monitors need an OAuth-backed `seed_inboxes.oauth_connection_id`.
- Queue probes from Settings, then let `seed-monitor` send and observe them.

## RLS

RLS is enabled across workspace tables. App users can only access workspace-scoped data unless they are admins or owners. Billing events/invoices remain admin-readable only.
