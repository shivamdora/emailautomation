# OutboundFlow

<p align="center">
  Internal outbound operations for modern teams.
</p>

<p align="center">
  <strong>Next.js 16</strong> · <strong>Supabase</strong> · <strong>Gmail Sync</strong> · <strong>CRM Integrations</strong> · <strong>Seed Monitoring</strong>
</p>

<p align="center">
  Production-grade outbound infrastructure with workspace-aware access, campaign workflows, template management, analytics, CRM sync, and mailbox operations in one system.
</p>

---

## Product Preview

![OutboundFlow Dashboard](./Outboundflow-Dashboard.png)

> If the screenshot lives in another folder, update the image path above to match its actual location.

## Overview

OutboundFlow is a production-ready internal outbound platform built for small teams that need a reliable system for campaign execution, mailbox operations, CRM sync, and delivery visibility.

It combines a modern Next.js application layer with Supabase Auth/Postgres/Edge Functions, Gmail sending and reply sync, HTML email templates, entitlement-aware billing controls, and owned seed inbox monitoring.

## Highlights

- Workspace-first architecture with personal workspace creation and shared workspace auto-join
- Gmail mailbox connection, sending workflows, and reply synchronization
- Campaign execution with tracked outbound events
- HTML template gallery with seeded starter templates per workspace
- Open and click tracking with reply disposition handling
- HubSpot and Salesforce OAuth foundations for CRM sync
- Custom CRM webhook and managed API key support
- Internal billing plans, entitlements, usage tracking, and billing history
- Owned seed inbox monitoring with queued probes and placement reporting
- Supabase cron-ready edge functions for operational background jobs

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase Auth, Postgres, Storage, Edge Functions, and Cron
- React Hook Form and Zod
- Recharts for analytics
- Gmail API for mailbox send and sync
- HubSpot and Salesforce OAuth integrations

## Dependency Summary

Runtime dependencies from [`package.json`](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/package.json):

- App framework: `next`, `react`, `react-dom`
- Data and auth: `@supabase/ssr`, `@supabase/supabase-js`
- Forms and validation: `react-hook-form`, `@hookform/resolvers`, `zod`
- UI primitives: `@radix-ui/*`, `lucide-react`, `sonner`
- Tables and analytics: `@tanstack/react-table`, `recharts`
- Utilities: `clsx`, `class-variance-authority`, `tailwind-merge`, `date-fns`, `date-fns-tz`
- Integrations and data handling: `googleapis`, `jose`, `papaparse`, `xlsx`

Development dependencies:

- `typescript`
- `eslint`, `eslint-config-next`
- `tailwindcss`, `@tailwindcss/postcss`
- `vitest`, `@vitejs/plugin-react`
- `electron`, `electron-builder`
- `babel-plugin-react-compiler`

Optional dependency:

- `@upstash/redis` for branches that include Redis-backed cache modules

## Project Structure

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

## Prerequisites

Before starting, make sure you have:

- Node.js 20 or newer
- npm 10 or newer
- A Supabase project with database access
- Google Cloud OAuth credentials for Gmail mailbox connect
- Optional HubSpot OAuth app credentials
- Optional Salesforce connected app credentials
- Optional Upstash Redis credentials if your branch enables Redis cache support

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. If your branch includes Redis cache files such as `src/lib/cache/redis.ts`, install the Redis client:

   ```bash
   npm install @upstash/redis
   ```

3. Copy the environment template:

   ```bash
   cp env.example .env.local
   ```

4. Fill in `.env.local` with real credentials for Supabase, Gmail, and any CRM providers you plan to use.

5. Apply the Supabase migrations listed in the rollout section below.

6. Start the development server:

   ```bash
   npm run dev
   ```

7. Verify the project locally:

   ```bash
   npm run lint
   npm test
   npm run build
   ```

8. If Turbopack continues to surface stale module errors, clear the local build cache and rebuild:

   ```bash
   Remove-Item -Recurse -Force .next
   npm run build
   ```

## Environment Setup

Required environment variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`
- `MICROSOFT_OAUTH_REDIRECT_URI`
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
- `USE_REDIS_CACHE`
- `REDIS_CACHE_MODE`
- `REDIS_CACHE_PREFIX`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Reference template: [`env.example`](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/env.example)

Current env groups:

- App and Supabase: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
- Gmail OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`
- CRM OAuth: `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_OAUTH_REDIRECT_URI`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_OAUTH_REDIRECT_URI`, `SALESFORCE_AUTH_BASE_URL`
- Security and limits: `TOKEN_ENCRYPTION_KEY`, `SUPABASE_CRON_VERIFY_SECRET`, `DEFAULT_PER_USER_DAILY_CAP`, `DEFAULT_PER_MINUTE_THROTTLE`, `FOLLOW_UP_DELAY_DAYS`, `SEED_MONITOR_INTERVAL_MINUTES`
- Workspace and custom CRM settings: `CUSTOM_CRM_API_KEYS`, `SHARED_WORKSPACE_NAME`, `SHARED_WORKSPACE_SLUG`
- Demo toggle: `ENABLE_DEMO_SEED`

If you enable Redis-backed caching in your branch, also add the Redis environment variables required by that module before running `npm run build`.

## Supabase Rollout

Apply the database migrations in order:

- [20260310235900_init_outboundflow.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260310235900_init_outboundflow.sql)
- [20260320154500_launch_foundations.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260320154500_launch_foundations.sql)
- [20260320190000_production_completion.sql](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/supabase/migrations/20260320190000_production_completion.sql)

Additional setup notes: [docs/supabase-setup.md](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/docs/supabase-setup.md)
Reusable Codex build prompt: [docs/codex-master-build-prompt.md](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/emailautomation/docs/codex-master-build-prompt.md)
Docs index: [docs/README.md](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/emailautomation/docs/README.md)

## Edge Functions and Cron

Included functions:

- `send-due-messages`
- `sync-replies`
- `crm-sync`
- `seed-monitor`

Recommended schedule:

- `send-due-messages`: every 1 minute
- `sync-replies`: every 1 minute
- `crm-sync`: every 15 minutes
- `seed-monitor`: every `SEED_MONITOR_INTERVAL_MINUTES`

All scheduled requests should include:

```text
x-cron-secret: <SUPABASE_CRON_VERIFY_SECRET>
```

## CRM Integrations

- Custom CRM inbound import: `POST /api/import/custom-crm/contacts`
- Custom CRM authentication is connection-managed rather than env-managed
- HubSpot and Salesforce connect via `/api/crm/connect/[provider]`

Contract notes: [docs/custom-crm-import.md](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/emailautomation/docs/custom-crm-import.md)

## Seed Monitoring

- Gmail seed inboxes connect through `/api/settings/seed-inboxes/connect`
- Probe jobs are queued from Settings and processed by the `seed-monitor` function
- Placement reporting is exact for owned monitored inboxes only

## Architecture Notes

- Billing is internal-only and controls entitlements rather than public payment collection
- CRM sync and writeback center on `crm_connections`, `crm_sync_runs`, `crm_object_links`, and `crm_push_jobs`
- Template seeding is idempotent and runs automatically for new and existing workspaces
- Tokens are encrypted server-side with `TOKEN_ENCRYPTION_KEY`

## Troubleshooting

### `Module not found: Can't resolve '@upstash/redis'`

This error means the code being built imports `@upstash/redis`, but the package is not installed in the current workspace.

Install it with:

```bash
npm install @upstash/redis
```

If the dependency was already removed from the source code and the error still appears, clear the cached Next.js output and rebuild:

```bash
Remove-Item -Recurse -Force .next
npm run build
```

---

Built for teams that want a clean internal system for outbound execution, mailbox operations, CRM synchronization, and delivery visibility without stitching together multiple disconnected tools.
