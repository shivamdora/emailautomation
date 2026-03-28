# Codex Master Build Prompt

Copy the prompt below into Codex when you want it to rebuild a reusable full-clone email marketing platform from scratch on a clean machine. The prompt is intentionally specific so Codex can make steady implementation progress without stopping after scaffolding.

```text
You are a senior full-stack product engineer. Build a production-ready web application called "RelayFlow" as a reusable full-clone outbound email marketing platform. The product should match the depth and completeness of a modern internal outbound operations tool, not a toy demo. Work end to end until the app is fully scaffolded, implemented, documented, and verified.

Important execution rules:
- Treat this as a full implementation request, not a planning-only request.
- If the workspace is empty, scaffold the project. If a project already exists, inspect it first and adapt without destroying user work.
- Do not stop after UI scaffolding. Implement the database schema, routes, services, jobs, docs, env examples, tests, and deployment notes too.
- Make reasonable implementation decisions when details are missing, but record them in the README under "Assumptions made during implementation".
- Prefer real integrations and production-safe interfaces. If live provider credentials are unavailable, still implement the real integration flow, disabled states, configuration surfaces, and documentation so the project becomes functional as soon as secrets are added.
- Finish by running lint, tests, and production build, then summarize any remaining setup steps.

Product goal:
Build a workspace-first outbound email platform for founders, SDR teams, agencies, and operators. The system must handle contacts, imports, templates, campaigns, sending, reply sync, analytics, CRM sync, seed monitoring, project-specific sender identities, and admin controls from one cohesive product.

Primary stack:
- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase Auth
- Supabase Postgres with SQL migrations
- Supabase Storage
- Supabase Edge Functions
- Supabase Cron-compatible background job triggers
- React Hook Form + Zod
- Recharts for analytics
- TanStack Table for tabular views
- Gmail API and Microsoft Outlook/Microsoft Graph OAuth for mailbox connections

Package and tooling expectations:
- Create a standard Next.js app with strict TypeScript enabled.
- Add ESLint and a Vitest test setup.
- Use server components by default where appropriate, with client components for interactive flows.
- Keep the codebase organized into folders similar to:
  - src/app
  - src/components
  - src/lib
  - src/services
  - src/content
  - supabase/migrations
  - supabase/functions
  - docs
- Include env.example, README.md, and any setup docs required for a clean install.

Branding and design direction:
- Use generic branding so anyone can reuse the app. Use the placeholder brand name "RelayFlow".
- The public marketing site should feel cinematic and premium:
  - dark, atmospheric hero
  - layered gradients and soft orb lighting
  - subtle grid textures
  - strong magenta accent with supporting blue-violet depth
  - large typography and clear CTA hierarchy
- The authenticated app should switch to a bright frosted-glass workspace aesthetic:
  - light blue-gray background
  - rounded cards and controls
  - soft glass surfaces
  - magenta primary accent
  - subtle chart palette
  - restrained but meaningful reveal and state transitions
- Typography:
  - use a Manrope-like sans font for UI
  - use an IBM Plex Mono-like font for labels, metadata, pills, and analytics annotations
- Ensure desktop and mobile support. The layout must remain usable on smaller screens.
- Avoid generic dashboard boilerplate. The visual system should feel intentional and productized.

Core product architecture:
- Multi-user authentication with Supabase Auth
- Workspace-first access model
- Automatic personal workspace creation on first sign-up
- Support for a shared workspace concept if configured via env
- Multi-project support inside each workspace
- Every project can have its own website, brand name, sender display name, sender title, sender signature, and logo
- Mailboxes, contacts, templates, campaigns, threads, CRM connections, and seed monitors must be workspace-scoped and, where appropriate, project-scoped
- Owner/admin roles should control privileged setup and operations

Public site and top-level product areas:
- Marketing homepage with product narrative, proof cards, workflow explanation, CTA blocks, and sign-in/sign-up paths
- Auth area:
  - sign in
  - sign up
  - forgot password
  - auth callback
  - onboarding/welcome flow for new users
- App shell with sidebar/topbar and active workspace/project context
- Main pages:
  - dashboard
  - analytics
  - campaigns list
  - campaign detail
  - new campaign
  - edit campaign
  - contacts
  - imports
  - templates
  - inbox
  - profile
  - settings overview
  - settings/sending
  - settings/projects
  - settings/integrations
  - settings/advanced

Required product behavior by area:

1. Authentication and onboarding
- Email/password sign-up and sign-in
- OAuth sign-in support where practical with Supabase
- Protected app routes
- Welcome flow that captures profile details like full name and title
- Automatic workspace membership resolution
- Redirect users into onboarding until first-time setup is complete

2. Dashboard
- KPI cards for:
  - total leads
  - queued
  - sent
  - follow-up sent
  - replied
  - unsubscribed
  - failed
  - reply rate
- Reply-rate chart by campaign
- Project breakdown cards showing metrics by project
- Checklist card that tells operators what to set up next
- Live refresh control for reply sync

3. Analytics
- Project filter including "all projects"
- KPI overview matching dashboard metrics
- Campaign performance chart
- Project-level analytics breakdown cards
- Clear empty states

4. Contacts
- Manual contact create form
- Contacts manager with:
  - filters
  - search
  - selection
  - bulk delete
  - bulk tag add/remove
  - inline edit or detail edit
- Contact fields should include:
  - email
  - first name
  - last name
  - company
  - website
  - job title
  - custom fields JSON
  - unsubscribed state
- Contact tags must be first-class

5. Imports
- CSV upload
- XLSX upload
- Google Sheets-style import endpoint or import adapter surface
- Import mapper UI with field mapping preview
- Import history list with status and imported counts
- Custom CRM inbound import endpoint

6. Templates
- Template gallery scoped to workspace/project
- Support text and HTML templates
- Subject template plus body template/body HTML template
- Template preview tabs for HTML and text
- Starter seeded templates for new workspaces/projects
- Save/update flows with validation
- Template token preview support using sample contact/project values

7. Campaigns
- Campaign list with status, daily cap, timezone, and actions
- New campaign wizard that supports:
  - template-based start
  - scratch start
  - at least two steps by default
  - optional advanced workflow extension
  - sender mailbox selection
  - contact selection
  - send window selection
  - timezone selection
  - daily send limit
  - subject/body editing
  - HTML/text mode
  - launch-readiness checklist
  - preview contact merge data
- Campaign detail page should show:
  - metadata
  - steps
  - status
  - counts
  - recent events
  - associated contacts
- Campaign actions:
  - create
  - edit
  - launch
  - pause
  - send now
  - resend
  - delete
- Reply-aware logic must stop future sends for contacts who reply or unsubscribe

8. Inbox
- Thread list with pagination or infinite-load batch behavior
- Selected thread detail pane
- Messages within thread
- Reply action surface
- Disposition action surface
- Campaign/contact context visible in thread detail
- Sync endpoint that refreshes replies from connected mailboxes

9. Settings overview
- Workspace setup checklist
- Sending readiness summary
- CRM/integration summary
- Active project identity readiness
- Owner/admin-only notices when user lacks permissions

10. Settings: Sending
- Connect sender mailboxes for Gmail and Outlook
- Show mailbox registry grouped by project
- Connect, approve, disconnect, and status banners
- Active project context should be explicit
- Mailbox provider badge and approval state

11. Settings: Projects
- Create project
- Update brand fields
- Upload project logo
- Manage sender display name, title, and signature
- Show mailbox count and active project badges
- Active-project switching support via API

12. Settings: Integrations
- CRM OAuth foundations for:
  - HubSpot
  - Salesforce
  - Pipedrive
  - Zoho
- Workspace integrations hub for:
  - Slack alerts
  - Calendly
  - generic webhook
  - custom CRM inbound API key/secret management
- Connect/configure/disconnect flows
- Secret rotation surfaces where relevant

13. Settings: Advanced and billing controls
- Internal billing/entitlement screens
- Usage counters and limit visibility
- Billing history/events/invoices views
- Feature flag visibility where useful
- This is internal controls, not a full public checkout system

14. Deliverability and monitoring
- Seed inbox management
- Seed probe jobs
- Placement/result history
- Settings UI to connect seed inboxes and queue probes
- Seed-monitor background function

Required database/domain model:
Implement SQL migrations that create and evolve tables equivalent to the following concepts:
- profiles
- workspaces
- workspace_members
- workspace_billing_accounts
- workspace_usage_counters
- workspace_billing_events
- workspace_billing_invoices
- plan_limits
- feature_flags
- projects
- oauth_connections
- mailbox_accounts
- contacts
- contact_tags
- contact_tag_members
- contact_lists
- contact_list_members
- imports
- import_rows
- templates
- campaigns
- campaign_steps
- campaign_contacts
- campaign_send_jobs
- campaign_queue_runs
- outbound_messages
- message_threads
- thread_messages
- message_events
- unsubscribes
- crm_connections
- crm_object_links
- crm_sync_runs
- crm_push_jobs
- workspace_integrations
- seed_inboxes
- seed_probe_jobs
- seed_inbox_results
- system_health_snapshots
- activity_logs
- deletion_requests

Database rules:
- Use UUID primary keys.
- Add created_at and updated_at where appropriate.
- Apply row-level security for workspace-safe access.
- Enforce workspace scoping consistently.
- Add project_id to records that should be project-specific.
- Use enums or constrained text fields for statuses when helpful.
- Include indexes for common filters such as workspace_id, project_id, campaign_id, contact_id, thread_id, and queued/background states.

Required API and route groups:
- /api/auth/sign-out
- /api/contacts
- /api/contacts/[contactId]
- /api/contacts/bulk-delete
- /api/contacts/bulk-tags
- /api/imports/upload
- /api/imports/sheets
- /api/import/custom-crm/contacts
- /api/templates
- /api/campaigns/[campaignId]
- /api/campaigns/launch
- /api/campaigns/pause
- /api/campaigns/send-now
- /api/campaigns/resend
- /api/inbox/threads
- /api/inbox/threads/[threadId]
- /api/inbox/reply
- /api/inbox/disposition
- /api/replies/sync
- /api/mailboxes/connect/[provider]
- /api/mailboxes/callback/[provider]
- /api/mailboxes/approve
- /api/mailboxes/disconnect
- /api/crm/connect/[provider]
- /api/crm/callback/[provider]
- /api/crm/disconnect
- /api/crm/sync
- /api/integrations/slack/connect
- /api/integrations/slack/callback
- /api/integrations/slack/configure
- /api/integrations/calendly/connect
- /api/integrations/calendly/callback
- /api/integrations/calendly/configure
- /api/integrations/calendly/webhook
- /api/integrations/webhook/save
- /api/integrations/webhook/rotate-secret
- /api/integrations/disconnect
- /api/settings/billing
- /api/settings/seed-inboxes
- /api/settings/seed-inboxes/connect
- /api/settings/seed-inboxes/callback
- /api/settings/seed-inboxes/probe
- /api/settings/crm/custom
- /api/projects
- /api/projects/[projectId]
- /api/projects/[projectId]/logo
- /api/projects/active
- /api/profile
- /api/workspace/active
- /api/track/open
- /api/track/click
- /api/unsubscribes/[token]

Shared types and contracts you must define clearly:
- Workspace context returned to authenticated pages
- Project-scoped list item types for dashboards, campaigns, templates, contacts, and threads
- Campaign wizard form schema
- Workflow step input schema
- Template preview/token schema
- Inbox thread summary and detail payloads
- Analytics KPI and chart payloads
- Integration hub data contracts
- Permission and entitlement check helpers

Mailbox and sending behavior:
- Support Gmail and Outlook providers
- Store provider account metadata
- Track connection status and approval status
- Support sender approval notes/state
- Implement queue-based campaign sending, not naive immediate bulk send loops
- Respect send windows, timezones, daily send caps, and unsubscribe/reply states
- Persist outbound message records and message events
- Generate trackable open/click links and unsubscribe tokens

CRM and integration behavior:
- Implement connection records, sync run history, object links, and push jobs
- Add custom CRM inbound import/auth support
- Make Slack and Calendly connection/configuration surfaces usable
- Provide clear empty, success, and error states for integration setup

Caching and read models:
- Add read-model helpers or cache adapters for dashboard metrics, contacts, templates, campaigns, imports, threads, analytics, and tag lists
- These can read directly from Postgres or optionally layer Redis where configured
- If Redis is optional, guard it behind env flags and degrade gracefully without it

Background jobs and Supabase functions:
- Implement Supabase Edge Functions for:
  - send-due-messages
  - sync-replies
  - crm-sync
  - seed-monitor
- Add cron verification using a secret header such as x-cron-secret
- Document recommended schedules:
  - send-due-messages every 1 minute
  - sync-replies every 1 minute
  - crm-sync every 15 minutes
  - seed-monitor every configurable interval

Content and UX expectations:
- Centralize product copy where it reduces repetition
- Use polished empty states and setup guidance
- Show banners after OAuth callbacks and important actions
- Include live refresh or sync-now controls where operators need current data
- Prefer clarity and operational ergonomics over decorative complexity

Security and robustness requirements:
- Never expose service role secrets to the client
- Keep token encryption and secret handling server-side
- Validate user input with Zod
- Use permission checks on privileged actions
- Ensure routes reject cross-workspace access
- Handle missing provider credentials gracefully with actionable setup guidance
- Avoid destructive git commands or deleting unrelated user files if operating in an existing repo

Docs and setup files you must produce:
- README.md with:
  - product overview
  - tech stack
  - project structure
  - local setup
  - env setup
  - migration order
  - Supabase function deployment
  - cron configuration
  - provider setup summary
  - testing commands
  - assumptions made during implementation
- env.example with all required variables
- docs/supabase-setup.md
- docs/gmail-oauth.md
- docs/custom-crm-import.md
- any other docs needed to make setup realistic

Seed/demo expectations:
- Seed starter templates
- Seed a minimal demo workspace/project if a demo flag is enabled
- Keep seeding idempotent

Testing requirements:
Implement unit and integration-oriented tests for critical helpers and flows, including:
- auth/browser auth helpers
- workspace/project label logic
- navigation and sidebar persistence
- campaign wizard defaults and creator logic
- queue/shared campaign logic
- workflow definitions
- template gallery and preview helpers
- import parsing/mapping utilities
- time utilities
- inbox thread helpers

Acceptance criteria:
- A user can sign up, complete onboarding, and enter a protected app shell
- A workspace and project model are fully wired
- A project can be created and updated
- Gmail and Outlook mailbox connection flows exist with clear provider separation
- Contacts can be manually created and imported
- Tags can be added and removed in bulk
- Templates can be created in text and HTML mode
- A campaign can be built with at least two steps, validated, launched, paused, sent now, resent, edited, and deleted
- Queue jobs and message event records exist
- Reply sync updates inbox threads and prevents future sends to replied contacts
- Dashboard and analytics render meaningful KPI data
- CRM/integration setup surfaces exist and persist data
- Seed monitor tables, routes, and background job surfaces exist
- Internal billing/entitlement controls exist
- The project contains docs, env example, migrations, tests, and production build support

Implementation sequence you should follow:
1. Inspect the workspace and preserve any existing user work.
2. Scaffold the app and dependencies if missing.
3. Set up base layout, fonts, theme tokens, UI primitives, and route groups.
4. Implement Supabase clients, auth flow, workspace context, and onboarding.
5. Add SQL migrations and seed logic for the full schema.
6. Build project/workspace management and permission helpers.
7. Implement contacts, imports, templates, and related APIs.
8. Implement campaign builder, campaign APIs, send queue tables, and campaign pages.
9. Implement mailbox connection flows, inbox threads, reply sync, and message tracking.
10. Implement dashboard and analytics read models.
11. Implement integrations, CRM sync surfaces, seed monitoring, and internal billing controls.
12. Finish docs, env files, tests, and verification.

Final verification before you stop:
- Run lint
- Run tests
- Run production build
- If anything fails, fix it instead of merely reporting it
- Then provide a concise summary with:
  - what was built
  - what credentials/setup are still required
  - exact commands to run locally

Output style while working:
- Act like an execution-focused coding agent
- Give short progress updates while implementing
- Be decisive and keep moving unless a missing secret or hidden repo conflict truly blocks progress
```
