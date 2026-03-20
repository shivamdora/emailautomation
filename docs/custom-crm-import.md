# Custom CRM Import API

Custom CRM is now a production connector, not a placeholder. Inbound contact sync still uses the same endpoint shape, but auth is managed per CRM connection in the database instead of `CUSTOM_CRM_API_KEYS`.

## Endpoint

`POST /api/import/custom-crm/contacts`

## Auth

Use a bearer token issued from Settings when a Custom CRM connection is created or rotated.

Example:

```http
Authorization: Bearer ofcrm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The token is validated against the active `custom_crm` connection for the workspace, then hashed and matched server-side.

## Request body

```json
{
  "workspaceId": "00000000-0000-0000-0000-000000000001",
  "externalSource": "custom-crm",
  "contacts": [
    {
      "externalContactId": "crm-123",
      "email": "lead@example.com",
      "firstName": "Lead",
      "lastName": "Example",
      "company": "Example Co",
      "website": "https://example.com",
      "jobTitle": "Founder",
      "customFields": {
        "segment": "fintech"
      }
    }
  ]
}
```

## Behavior

- Validates payload with Zod
- Verifies the bearer token belongs to the same workspace and an active Custom CRM connection
- Upserts contacts by `(workspace_id, external_source, external_contact_id)`
- Creates or updates `crm_object_links` so writeback can target the same external contacts later
- Records `crm_sync_runs` for observability

## Outbound writeback

Each Custom CRM connection can optionally store an outbound webhook URL. When OutboundFlow records send, reply, unsubscribe, or meeting-booked events, it queues `crm_push_jobs` and posts JSON payloads like:

```json
{
  "type": "meeting_booked",
  "summary": "OutboundFlow recorded a meeting_booked event.",
  "contact": {
    "externalContactId": "crm-123",
    "email": "lead@example.com"
  },
  "metadata": {
    "campaignName": "Q2 SDR Push"
  }
}
```

If a webhook signing secret exists for the connection, requests include:

```http
x-outboundflow-signature: <sha256(secret + "." + rawBody)>
```

## Operational notes

- Key rotation happens from Settings and shows the new key only once.
- Existing env-scoped `CUSTOM_CRM_API_KEYS` can still work as a compatibility fallback, but production should use managed connection keys only.
