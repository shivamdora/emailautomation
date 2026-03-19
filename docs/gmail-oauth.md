# Gmail OAuth Setup

## Google Cloud setup

1. Create a Google Cloud project.
2. Enable the Gmail API.
3. Configure the OAuth consent screen.
4. Add test users during development.

## OAuth client

Create a Web application OAuth client and set:

- Authorized redirect URI: `http://localhost:3000/api/gmail/callback`
- Production redirect URI: `https://your-app-domain/api/gmail/callback`

## Required env vars

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY`

`GOOGLE_OAUTH_REDIRECT_URI` is optional as a fixed fallback. By default, the app now derives
the Gmail callback from the current request host and uses `/api/gmail/callback`.

## Scopes

- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.modify`

Sheets import stays public-URL-only in v1, so no Sheets scopes are requested.

## Token lifecycle

- Access tokens are short lived.
- Refresh tokens are encrypted and stored in `oauth_connections`.
- `gmail-service.refreshMailboxToken()` rotates tokens server-side.
- Mailbox disconnect updates `gmail_accounts.health_status` and pauses sending.

## Consent and compliance

- Keep [privacy page](/D:/Jayant/AI_Jayant/Cold%20Email/src/app/(marketing)/privacy/page.tsx) current before production use.
- Make sure Google OAuth branding references your real domain and policy URLs.
- Do not expose mailbox tokens to client components.
