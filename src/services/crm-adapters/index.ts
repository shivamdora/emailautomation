import "server-only";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { env, isHubSpotConfigured, isSalesforceConfigured } from "@/lib/supabase/env";

export type CrmProvider = "custom_crm" | "hubspot" | "salesforce";

export type CrmConnectionRecord = {
  id: string;
  workspace_id: string;
  provider: CrmProvider;
  status: string;
  auth_type?: string | null;
  provider_account_id?: string | null;
  provider_account_label?: string | null;
  provider_account_email?: string | null;
  access_token_encrypted?: string | null;
  refresh_token_encrypted?: string | null;
  token_expiry?: string | null;
  inbound_api_key_hash?: string | null;
  inbound_api_key_hint?: string | null;
  outbound_webhook_url?: string | null;
  webhook_signing_secret_encrypted?: string | null;
  sync_cursor_jsonb?: Record<string, unknown> | null;
  field_mapping_jsonb?: Record<string, unknown> | null;
  connection_metadata_jsonb?: Record<string, unknown> | null;
};

export type CrmOAuthExchangeResult = {
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiry?: string | null;
  providerAccountId?: string | null;
  providerAccountLabel?: string | null;
  providerAccountEmail?: string | null;
  connectionMetadata?: Record<string, unknown>;
};

export type CrmSyncContact = {
  externalId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  website?: string | null;
  jobTitle?: string | null;
  customFields?: Record<string, string | number | boolean | null>;
};

export type CrmPullSyncResult = {
  contacts: CrmSyncContact[];
  nextCursor?: Record<string, unknown> | null;
  providerAccountId?: string | null;
  providerAccountLabel?: string | null;
  providerAccountEmail?: string | null;
};

export type CrmWritebackPayload = {
  externalContactId?: string | null;
  email?: string | null;
  eventType: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

export interface CRMAdapter {
  provider: CrmProvider;
  isConfigured(): boolean;
  getConnectUrl?(state: string, redirectUri: string): string;
  exchangeCode?(code: string, redirectUri: string): Promise<CrmOAuthExchangeResult>;
  refreshToken?(connection: CrmConnectionRecord): Promise<CrmOAuthExchangeResult>;
  pullSync(connection: CrmConnectionRecord): Promise<CrmPullSyncResult>;
  writeback(connection: CrmConnectionRecord, payload: CrmWritebackPayload): Promise<void>;
}

async function parseJsonResponse<T>(response: Response, label: string) {
  if (!response.ok) {
    throw new Error(`${label} failed: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

async function getHubSpotAccessToken(connection: CrmConnectionRecord) {
  const tokenEncrypted = connection.access_token_encrypted;
  const expiry = connection.token_expiry ? new Date(connection.token_expiry).getTime() : null;

  if (tokenEncrypted && (!expiry || expiry > Date.now() + 60_000)) {
    return decryptToken(tokenEncrypted);
  }

  if (!connection.refresh_token_encrypted || !env.HUBSPOT_CLIENT_ID || !env.HUBSPOT_CLIENT_SECRET) {
    throw new Error("HubSpot connection is missing a refresh token.");
  }

  const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.HUBSPOT_CLIENT_ID,
      client_secret: env.HUBSPOT_CLIENT_SECRET,
      refresh_token: decryptToken(connection.refresh_token_encrypted),
    }),
  });
  const token = await parseJsonResponse<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }>(response, "HubSpot token refresh");

  return token.access_token;
}

async function getSalesforceAccessToken(connection: CrmConnectionRecord) {
  const tokenEncrypted = connection.access_token_encrypted;
  const expiry = connection.token_expiry ? new Date(connection.token_expiry).getTime() : null;

  if (tokenEncrypted && (!expiry || expiry > Date.now() + 60_000)) {
    return decryptToken(tokenEncrypted);
  }

  if (
    !connection.refresh_token_encrypted ||
    !env.SALESFORCE_CLIENT_ID ||
    !env.SALESFORCE_CLIENT_SECRET
  ) {
    throw new Error("Salesforce connection is missing a refresh token.");
  }

  const response = await fetch(`${env.SALESFORCE_AUTH_BASE_URL ?? "https://login.salesforce.com"}/services/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.SALESFORCE_CLIENT_ID,
      client_secret: env.SALESFORCE_CLIENT_SECRET,
      refresh_token: decryptToken(connection.refresh_token_encrypted),
    }),
  });

  const token = await parseJsonResponse<{
    access_token: string;
    instance_url?: string;
  }>(response, "Salesforce token refresh");

  return token.access_token;
}

function getHubSpotScopes() {
  return [
    "oauth",
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.objects.companies.read",
    "crm.objects.companies.write",
  ];
}

async function fetchHubSpotConnectionIdentity(accessToken: string) {
  const response = await fetch("https://api.hubapi.com/oauth/v1/access-tokens/" + accessToken, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return {};
  }

  return (await response.json()) as {
    hub_id?: number;
    user?: string;
  };
}

async function fetchSalesforceIdentity(accessToken: string, identityUrl: string | null | undefined) {
  if (!identityUrl) {
    return {};
  }

  const response = await fetch(identityUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return {};
  }

  return (await response.json()) as {
    organization_id?: string;
    username?: string;
    display_name?: string;
    email?: string;
  };
}

async function createHubSpotNote(accessToken: string, externalContactId: string, summary: string) {
  await parseJsonResponse(
    await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          hs_note_body: summary,
          hs_timestamp: Date.now(),
        },
        associations: [
          {
            to: { id: externalContactId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
          },
        ],
      }),
    }),
    "HubSpot note writeback",
  );
}

async function updateHubSpotContact(accessToken: string, externalContactId: string, properties: Record<string, unknown>) {
  await parseJsonResponse(
    await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${externalContactId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    }),
    "HubSpot contact update",
  );
}

async function createSalesforceTask(connection: CrmConnectionRecord, accessToken: string, externalContactId: string, summary: string) {
  const instanceUrl = String(connection.connection_metadata_jsonb?.instanceUrl ?? "");

  if (!instanceUrl) {
    throw new Error("Salesforce connection is missing an instance URL.");
  }

  await parseJsonResponse(
    await fetch(`${instanceUrl}/services/data/v60.0/sobjects/Task`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Subject: "OutboundFlow activity",
        Description: summary,
        Status: "Completed",
        Priority: "Normal",
        WhoId: externalContactId,
      }),
    }),
    "Salesforce task writeback",
  );
}

async function updateSalesforceContact(
  connection: CrmConnectionRecord,
  accessToken: string,
  externalContactId: string,
  fields: Record<string, unknown>,
) {
  const instanceUrl = String(connection.connection_metadata_jsonb?.instanceUrl ?? "");

  if (!instanceUrl) {
    throw new Error("Salesforce connection is missing an instance URL.");
  }

  await parseJsonResponse(
    await fetch(`${instanceUrl}/services/data/v60.0/sobjects/Contact/${externalContactId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fields),
    }),
    "Salesforce contact update",
  );
}

const customCrmAdapter: CRMAdapter = {
  provider: "custom_crm",
  isConfigured() {
    return true;
  },
  async pullSync() {
    return {
      contacts: [],
      nextCursor: null,
    };
  },
  async writeback(connection, payload) {
    if (!connection.outbound_webhook_url) {
      return;
    }

    const body = JSON.stringify({
      type: payload.eventType,
      summary: payload.summary,
      contact: {
        externalContactId: payload.externalContactId ?? null,
        email: payload.email ?? null,
      },
      metadata: payload.metadata ?? {},
    });
    const secret = connection.webhook_signing_secret_encrypted
      ? decryptToken(connection.webhook_signing_secret_encrypted)
      : null;
    const signature = secret
      ? Buffer.from(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}.${body}`)),
        ).toString("hex")
      : null;

    const response = await fetch(connection.outbound_webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "x-outboundflow-signature": signature } : {}),
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Custom CRM writeback failed: ${await response.text()}`);
    }
  },
};

const hubspotAdapter: CRMAdapter = {
  provider: "hubspot",
  isConfigured() {
    return isHubSpotConfigured;
  },
  getConnectUrl(state, redirectUri) {
    if (!env.HUBSPOT_CLIENT_ID) {
      throw new Error("HubSpot OAuth is not configured.");
    }

    const url = new URL("https://app.hubspot.com/oauth/authorize");
    url.searchParams.set("client_id", env.HUBSPOT_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", getHubSpotScopes().join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  },
  async exchangeCode(code, redirectUri) {
    const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.HUBSPOT_CLIENT_ID ?? "",
        client_secret: env.HUBSPOT_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        code,
      }),
    });
    const token = await parseJsonResponse<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      hub_id?: number;
    }>(response, "HubSpot token exchange");
    const identity = await fetchHubSpotConnectionIdentity(token.access_token);

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenExpiry: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
      providerAccountId: String(identity.hub_id ?? token.hub_id ?? ""),
      providerAccountLabel: identity.hub_id ? `HubSpot ${identity.hub_id}` : "HubSpot",
      providerAccountEmail: identity.user ?? null,
      connectionMetadata: {
        hubId: identity.hub_id ?? token.hub_id ?? null,
        scopes: getHubSpotScopes(),
      },
    };
  },
  async refreshToken(connection) {
    const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: env.HUBSPOT_CLIENT_ID ?? "",
        client_secret: env.HUBSPOT_CLIENT_SECRET ?? "",
        refresh_token: connection.refresh_token_encrypted
          ? decryptToken(connection.refresh_token_encrypted)
          : "",
      }),
    });
    const token = await parseJsonResponse<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>(response, "HubSpot token refresh");

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenExpiry: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
      connectionMetadata: connection.connection_metadata_jsonb ?? {},
    };
  },
  async pullSync(connection) {
    const accessToken = await getHubSpotAccessToken(connection);
    const after = String(connection.sync_cursor_jsonb?.after ?? "");
    const url = new URL("https://api.hubapi.com/crm/v3/objects/contacts");
    url.searchParams.set("limit", "100");
    url.searchParams.set("properties", "firstname,lastname,email,jobtitle,website,company");
    if (after) {
      url.searchParams.set("after", after);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = await parseJsonResponse<{
      results?: Array<{
        id: string;
        properties?: Record<string, string | null>;
      }>;
      paging?: { next?: { after?: string | null } | null } | null;
    }>(response, "HubSpot contact sync");

    return {
      contacts: (payload.results ?? [])
        .map((contact) => ({
          externalId: contact.id,
          email: String(contact.properties?.email ?? "").trim(),
          firstName: contact.properties?.firstname ?? null,
          lastName: contact.properties?.lastname ?? null,
          company: contact.properties?.company ?? null,
          website: contact.properties?.website ?? null,
          jobTitle: contact.properties?.jobtitle ?? null,
        }))
        .filter((contact) => Boolean(contact.email)),
      nextCursor: payload.paging?.next?.after ? { after: payload.paging.next.after } : null,
      providerAccountId: connection.provider_account_id ?? null,
      providerAccountLabel: connection.provider_account_label ?? "HubSpot",
      providerAccountEmail: connection.provider_account_email ?? null,
    };
  },
  async writeback(connection, payload) {
    const accessToken = await getHubSpotAccessToken(connection);

    if (payload.externalContactId) {
      await createHubSpotNote(accessToken, payload.externalContactId, payload.summary);
      const statusField = String(connection.field_mapping_jsonb?.statusField ?? "").trim();

      if (statusField) {
        await updateHubSpotContact(accessToken, payload.externalContactId, {
          [statusField]: payload.eventType,
        });
      }
    }
  },
};

const salesforceAdapter: CRMAdapter = {
  provider: "salesforce",
  isConfigured() {
    return isSalesforceConfigured;
  },
  getConnectUrl(state, redirectUri) {
    if (!env.SALESFORCE_CLIENT_ID) {
      throw new Error("Salesforce OAuth is not configured.");
    }

    const url = new URL("/services/oauth2/authorize", env.SALESFORCE_AUTH_BASE_URL ?? "https://login.salesforce.com");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", env.SALESFORCE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "api refresh_token offline_access");
    url.searchParams.set("state", state);
    return url.toString();
  },
  async exchangeCode(code, redirectUri) {
    const response = await fetch(`${env.SALESFORCE_AUTH_BASE_URL ?? "https://login.salesforce.com"}/services/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.SALESFORCE_CLIENT_ID ?? "",
        client_secret: env.SALESFORCE_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        code,
      }),
    });
    const token = await parseJsonResponse<{
      access_token: string;
      refresh_token?: string;
      instance_url?: string;
      id?: string;
      issued_at?: string;
    }>(response, "Salesforce token exchange");
    const identity = await fetchSalesforceIdentity(token.access_token, token.id);

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      providerAccountId: identity.organization_id ?? token.id ?? null,
      providerAccountLabel: identity.display_name ?? "Salesforce",
      providerAccountEmail: identity.email ?? identity.username ?? null,
      connectionMetadata: {
        identityUrl: token.id ?? null,
        instanceUrl: token.instance_url ?? null,
        username: identity.username ?? null,
      },
    };
  },
  async refreshToken(connection) {
    const response = await fetch(`${env.SALESFORCE_AUTH_BASE_URL ?? "https://login.salesforce.com"}/services/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: env.SALESFORCE_CLIENT_ID ?? "",
        client_secret: env.SALESFORCE_CLIENT_SECRET ?? "",
        refresh_token: connection.refresh_token_encrypted
          ? decryptToken(connection.refresh_token_encrypted)
          : "",
      }),
    });
    const token = await parseJsonResponse<{
      access_token: string;
      instance_url?: string;
    }>(response, "Salesforce token refresh");

    return {
      accessToken: token.access_token,
      connectionMetadata: {
        ...(connection.connection_metadata_jsonb ?? {}),
        instanceUrl: token.instance_url ?? connection.connection_metadata_jsonb?.instanceUrl ?? null,
      },
    };
  },
  async pullSync(connection) {
    const accessToken = await getSalesforceAccessToken(connection);
    const instanceUrl = String(connection.connection_metadata_jsonb?.instanceUrl ?? "");

    if (!instanceUrl) {
      throw new Error("Salesforce connection is missing an instance URL.");
    }

    const nextPath = String(connection.sync_cursor_jsonb?.nextRecordsUrl ?? "");
    const queryPath =
      nextPath ||
      `/services/data/v60.0/query?q=${encodeURIComponent(
        "SELECT Id, FirstName, LastName, Email, Title, Account.Name, Account.Website FROM Contact WHERE Email != null ORDER BY LastModifiedDate DESC LIMIT 200",
      )}`;
    const response = await fetch(`${instanceUrl}${queryPath}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = await parseJsonResponse<{
      records?: Array<{
        Id: string;
        FirstName?: string | null;
        LastName?: string | null;
        Email?: string | null;
        Title?: string | null;
        Account?: { Name?: string | null; Website?: string | null } | null;
      }>;
      nextRecordsUrl?: string | null;
    }>(response, "Salesforce contact sync");

    return {
      contacts: (payload.records ?? [])
        .map((contact) => ({
          externalId: contact.Id,
          email: String(contact.Email ?? "").trim(),
          firstName: contact.FirstName ?? null,
          lastName: contact.LastName ?? null,
          company: contact.Account?.Name ?? null,
          website: contact.Account?.Website ?? null,
          jobTitle: contact.Title ?? null,
        }))
        .filter((contact) => Boolean(contact.email)),
      nextCursor: payload.nextRecordsUrl ? { nextRecordsUrl: payload.nextRecordsUrl } : null,
      providerAccountId: connection.provider_account_id ?? null,
      providerAccountLabel: connection.provider_account_label ?? "Salesforce",
      providerAccountEmail: connection.provider_account_email ?? null,
    };
  },
  async writeback(connection, payload) {
    if (!payload.externalContactId) {
      return;
    }

    const accessToken = await getSalesforceAccessToken(connection);
    await createSalesforceTask(connection, accessToken, payload.externalContactId, payload.summary);
    const statusField = String(connection.field_mapping_jsonb?.statusField ?? "").trim();

    if (statusField) {
      await updateSalesforceContact(connection, accessToken, payload.externalContactId, {
        [statusField]: payload.eventType,
      });
    }
  },
};

const registry: Record<CrmProvider, CRMAdapter> = {
  custom_crm: customCrmAdapter,
  hubspot: hubspotAdapter,
  salesforce: salesforceAdapter,
};

export function getCRMAdapter(provider: CrmProvider) {
  const adapter = registry[provider];

  if (!adapter) {
    throw new Error(`Unsupported CRM provider: ${provider}`);
  }

  return adapter;
}

export function listCRMProviders() {
  return Object.values(registry);
}

export function getEncryptedTokenValue(value: string | null | undefined) {
  return value ? encryptToken(value) : null;
}
