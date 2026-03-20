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
2. [supabase/migrations/20260320154500_launch_foundations.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260320154500_launch_foundations.sql)
3. [supabase/migrations/20260320190000_production_completion.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260320190000_production_completion.sql)

The latest migration adds:

- CRM auth and writeback columns on `crm_connections`
- `crm_push_jobs`
- `workspace_billing_events`
- `workspace_billing_invoices`
- expanded `plan_limits` and `workspace_usage_counters`
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

- Every 5 minutes: `send-due-messages`
- Every 5 minutes: `sync-replies`
- Every 15 minutes: `crm-sync`
- Every `SEED_MONITOR_INTERVAL_MINUTES`: `seed-monitor`

Pass `x-cron-secret: <SUPABASE_CRON_VERIFY_SECRET>` in each scheduled invocation.

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
