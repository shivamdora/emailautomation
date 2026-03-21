# OutboundFlow

OutboundFlow is a production-grade internal outbound platform for small teams. It uses Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth/Postgres/Edge Functions, Gmail sending and reply sync, HTML email templates, CRM connectors, billing entitlements, and owned seed inbox monitoring.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Supabase Auth, Postgres, Storage, Edge Functions, Cron
- React Hook Form + Zod
- Recharts for dashboard analytics
- Gmail API for mailbox send and sync
- HubSpot, Salesforce, Pipedrive, and Zoho OAuth for CRM sync
- Slack, Calendly, Hunter, and signed generic webhooks for workspace integrations

## What ships now

- Direct sign-up with personal workspace creation and shared workspace auto-join
- Active workspace switching and role-aware shared workspace permissions
- Gmail mailbox connection with workspace approval gating
- Workflow-based outbound campaigns with tracked events
- HTML-rendered email template gallery with two seeded ready-to-use templates per workspace
- Open and click tracking plus reply disposition handling
- Custom CRM managed API keys and webhook writeback
- HubSpot, Salesforce, Pipedrive, and Zoho OAuth connection flows with contact sync foundations
- Slack alerts, signed webhooks, Hunter verification, and Calendly meeting-booked automation
- Internal billing plans, entitlement enforcement, usage tracking, and billing history
- Gmail-first seed inbox monitoring with queued placement probes and result history
- Supabase cron functions for send queue, reply sync, CRM sync, and seed monitoring

## Project layout

```text
src/app
src/components
src/lib
src/services
supabase/migrations
supabase/functions
supabase/seed.sql
docs/
```

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy env template:

   ```bash
   cp env.example .env.local
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Verify locally:

   ```bash
   npm run lint
   npm test
   npm run build
   ```

## Required env vars

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `HUBSPOT_CLIENT_ID`
- `HUBSPOT_CLIENT_SECRET`
- `HUBSPOT_OAUTH_REDIRECT_URI`
- `SALESFORCE_CLIENT_ID`
- `SALESFORCE_CLIENT_SECRET`
- `SALESFORCE_OAUTH_REDIRECT_URI`
- `SALESFORCE_AUTH_BASE_URL`
- `PIPEDRIVE_CLIENT_ID`
- `PIPEDRIVE_CLIENT_SECRET`
- `PIPEDRIVE_OAUTH_REDIRECT_URI`
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_OAUTH_REDIRECT_URI`
- `ZOHO_ACCOUNTS_BASE_URL`
- `ZOHO_API_BASE_URL`
- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_OAUTH_REDIRECT_URI`
- `CALENDLY_CLIENT_ID`
- `CALENDLY_CLIENT_SECRET`
- `CALENDLY_OAUTH_REDIRECT_URI`
- `TOKEN_ENCRYPTION_KEY`
- `SUPABASE_CRON_VERIFY_SECRET`
- `SHARED_WORKSPACE_NAME`
- `SHARED_WORKSPACE_SLUG`
- `SEED_MONITOR_INTERVAL_MINUTES`

## Supabase rollout

Apply migrations in order:

- [supabase/migrations/20260310235900_init_outboundflow.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260310235900_init_outboundflow.sql)
- [supabase/migrations/20260320154500_launch_foundations.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260320154500_launch_foundations.sql)
- [supabase/migrations/20260320190000_production_completion.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260320190000_production_completion.sql)

Detailed notes: [docs/supabase-setup.md](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/docs/supabase-setup.md)

## Edge functions and cron

Functions included:

- `send-due-messages`
- `sync-replies`
- `crm-sync`
- `seed-monitor`

Recommended schedule:

- `send-due-messages`: every 1 minute
- `sync-replies`: every 1 minute
- `crm-sync`: every 15 minutes
- `seed-monitor`: every `SEED_MONITOR_INTERVAL_MINUTES`

All scheduled calls should send `x-cron-secret: <SUPABASE_CRON_VERIFY_SECRET>`.
The send queue is minute-driven: initial sends and follow-ups are dispatched on the next 1-minute worker tick once they become eligible.

## CRM integrations

- Custom CRM inbound import remains `POST /api/import/custom-crm/contacts`
- Custom CRM auth is now connection-managed instead of env-managed
- HubSpot, Salesforce, Pipedrive, and Zoho connect through `/api/crm/connect/[provider]`
- Slack, generic webhooks, Hunter, and Calendly are managed through `/settings/integrations`

Contract details: [docs/custom-crm-import.md](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/docs/custom-crm-import.md)

## Seed monitoring

- Gmail seed inboxes connect through `/api/settings/seed-inboxes/connect`
- Probe jobs are queued from Settings and processed by the `seed-monitor` function
- Placement reporting is exact for owned monitored inboxes only

## Notes on architecture

- Billing stays internal-only and controls entitlements rather than public payment collection.
- CRM sync and writeback are centered on `crm_connections`, `crm_sync_runs`, `crm_object_links`, and `crm_push_jobs`.
- Workspace-level non-CRM integrations are centered on `workspace_integrations`.
- Template seeding is idempotent and happens automatically for new and existing workspaces.
- Tokens are encrypted server-side with `TOKEN_ENCRYPTION_KEY`.
