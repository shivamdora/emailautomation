# Supabase Setup

## Project services used

- Auth
- Postgres
- Storage
- Edge Functions
- Cron

## Google sign-in via Supabase

App login with the "Continue with Google" button uses Supabase Auth, not the custom Gmail mailbox OAuth route.

The browser flow in this repo is:

1. User clicks Google sign-in in the app.
2. Supabase starts the OAuth flow.
3. Google redirects back to the Supabase callback.
4. Supabase sends the browser back to `/auth/callback` on the app origin.

That means the Google Cloud OAuth client configured in Supabase must include this authorized redirect URI:

- `https://dbsmydauvhbnlqgezscl.supabase.co/auth/v1/callback`

And Supabase Auth itself must allow both app callback URLs:

- `http://localhost:3000/auth/callback`
- `https://outbound-flow.vercel.app/auth/callback`

If Google shows `Error 400: redirect_uri_mismatch` during app sign-in, the problem is almost always the Google client configured in Supabase, not the custom Gmail env vars.

## Apply schema

Run the migration in:

- [supabase/migrations/20260310235900_init_outboundflow.sql](/D:/Jayant/AI_Jayant/Cold%20Email/supabase/migrations/20260310235900_init_outboundflow.sql)

## Seed data

Optional local seed file:

- [supabase/seed.sql](/D:/Jayant/AI_Jayant/Cold%20Email/supabase/seed.sql)

If you use the seed, either:

- replace the placeholder user UUID with a real auth user ID, or
- let the UI run in demo mode without a configured Supabase project

## Storage

Expected bucket:

- `imports`

It stores uploaded CSV/XLSX files before normalization.

## Edge Functions

Deploy:

- `supabase/functions/send-due-messages`
- `supabase/functions/sync-replies`

Required secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `TOKEN_ENCRYPTION_KEY`
- `SUPABASE_CRON_VERIFY_SECRET`
- Gmail OAuth secrets

## Cron schedule

- Every 5 minutes: `send-due-messages`
- Every 5 minutes: `sync-replies`

Pass `x-cron-secret: <SUPABASE_CRON_VERIFY_SECRET>` in the scheduled invocation.

## RLS

RLS is enabled across workspace tables. App users access only workspace-scoped data unless they are admins/owners. Sensitive OAuth rows are intentionally not readable from client sessions.
