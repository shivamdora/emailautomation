# OutboundFlow

OutboundFlow is a production-shaped internal MVP for small outbound teams. It uses Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI primitives, Supabase Auth/Postgres/Storage/Edge Functions, and a provider-based mailbox integration layer with Gmail active in v1.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Supabase Auth, Postgres, Storage, Edge Functions, Cron
- React Hook Form + Zod
- Recharts for dashboard analytics
- Google Gmail API for send and thread sync

## What ships in v1

- Email/password sign-up and sign-in
- Default workspace bootstrap per new user
- Profile page with separate Gmail mailbox connection flow
- CSV/XLSX upload and Google Sheets public URL import
- Common contacts table with custom fields
- Template creation with merge variables
- Campaign builder with one initial email and one 2-day follow-up
- Background send queue and reply sync via Supabase Edge Functions
- Thread history inside the app
- Dashboard analytics from database state
- RLS, audit logs, unsubscribe records, and SaaS-ready extension points

## Explicitly excluded in v1

- Live CRM sync
- Multiple mailbox providers
- Billing
- Advanced sequencing
- A/B testing
- Open tracking

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

3. Start local app:

   ```bash
   npm run dev
   ```

4. Optional helper checks:

   ```bash
   npm run lint
   npm run test
   ```

## Windows desktop app

The repo now includes an Electron-based Windows app shell in `windows-app/` that loads the hosted OutboundFlow app and does not package backend secrets.

- Start the web app locally: `npm run dev`
- Start the desktop app in development: `npm run desktop:dev`
- Build the safe desktop config: `npm run desktop:build:config`
- Build the unpacked Windows app: `npm run desktop:build`
- Build the NSIS installer: `npm run desktop:pack`

Desktop builds package only desktop-safe config such as the hosted app origin and custom protocol. Server secrets stay in the hosted web deployment.

Release notes: [docs/vercel-desktop-release.md](/Users/admin/Desktop/AI/outboundflow/outboundflow-new/emailautomation/docs/vercel-desktop-release.md)

## Supabase setup

1. Create a Supabase project.
2. Apply the SQL migration in [supabase/migrations/20260310235900_init_outboundflow.sql](/D:/Jayant/AI_Jayant/Cold%20Email/supabase/migrations/20260310235900_init_outboundflow.sql).
3. Optionally run [supabase/seed.sql](/D:/Jayant/AI_Jayant/Cold%20Email/supabase/seed.sql) after creating a test auth user.
4. Create an `imports` Storage bucket if the migration has not already done it.
5. Set the env vars from `env.example`.

Detailed notes: [docs/supabase-setup.md](/D:/Jayant/AI_Jayant/Cold%20Email/docs/supabase-setup.md)

Google sign-in for app login runs through Supabase Auth. In Google Cloud, the OAuth client used by Supabase must authorize only the Supabase callback:

- `https://dbsmydauvhbnlqgezscl.supabase.co/auth/v1/callback`

Then add your app URLs in Supabase Auth redirect settings:

- `http://localhost:3000/auth/callback`
- `https://outbound-flow.vercel.app/auth/callback`

## Gmail OAuth setup

Detailed notes: [docs/gmail-oauth.md](/D:/Jayant/AI_Jayant/Cold%20Email/docs/gmail-oauth.md)

Required scopes in v1:

- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.modify`

The Gmail connect flow is separate from Supabase Auth and lands in `/api/gmail/callback`.

## Edge Functions and cron

Functions included:

- `send-due-messages`
- `sync-replies`

Recommended schedule:

- `send-due-messages`: every 5 minutes
- `sync-replies`: every 5 minutes

Both functions expect `SUPABASE_CRON_VERIFY_SECRET` and reject requests if the secret is present but missing from the `x-cron-secret` header.

## Send limits and follow-up delay

- Default per-user cap: `DEFAULT_PER_USER_DAILY_CAP`
- Default per-minute throttle: `DEFAULT_PER_MINUTE_THROTTLE`
- Follow-up delay: `FOLLOW_UP_DELAY_DAYS`

Campaign-specific caps and send windows are stored per campaign in Postgres.

## Custom CRM placeholder API

The extension point for future CRM ingestion is:

`POST /api/import/custom-crm/contacts`

Auth model:

- Bearer token
- Workspace-scoped secret from `CUSTOM_CRM_API_KEYS`
- Idempotent upsert by `(workspace_id, external_source, external_contact_id)`

Contract details: [docs/custom-crm-import.md](/D:/Jayant/AI_Jayant/Cold%20Email/docs/custom-crm-import.md)

## Notes on architecture

- Mailbox logic is behind `MailboxProvider` interfaces even though Gmail is the only active provider in v1.
- CRM logic is behind `CRMAdapter` interfaces even though live CRM sync is intentionally excluded.
- Queue state lives in Postgres tables instead of external worker infrastructure.
- Tokens are stored server-side only and encrypted with `TOKEN_ENCRYPTION_KEY`.
- Pages call service modules rather than embedding business logic in UI components.

## Shadcn-style primitives used

- `button`
- `card`
- `badge`
- `input`
- `textarea`
- `label`
- `table`
- `tabs`
- `separator`
- `toaster`
