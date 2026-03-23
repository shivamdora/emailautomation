import "server-only";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import {
  env,
  isHubSpotConfigured,
  isPipedriveConfigured,
  isSalesforceConfigured,
  isZohoConfigured,
} from "@/lib/supabase/env";

export type CrmProvider = "custom_crm" | "hubspot" | "salesforce" | "pipedrive" | "zoho";

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

function getPipedriveScopes() {
  return ["base", "contacts:read", "contacts:full"];
}

function getZohoScopes() {
  return ["ZohoCRM.modules.ALL", "ZohoCRM.users.READ", "offline_access"];
}

function getZohoAccountsBaseUrl() {
  return env.ZOHO_ACCOUNTS_BASE_URL ?? "https://accounts.zoho.com";
}

async function getPipedriveAccessToken(connection: CrmConnectionRecord) {
  const tokenEncrypted = connection.access_token_encrypted;
  const expiry = connection.token_expiry ? new Date(connection.token_expiry).getTime() : null;

  if (tokenEncrypted && (!expiry || expiry > Date.now() + 60_000)) {
    return decryptToken(tokenEncrypted);
  }

  if (!connection.refresh_token_encrypted || !env.PIPEDRIVE_CLIENT_ID || !env.PIPEDRIVE_CLIENT_SECRET) {
    throw new Error("Pipedrive connection is missing a refresh token.");
  }

  const response = await fetch("https://oauth.pipedrive.com/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${env.PIPEDRIVE_CLIENT_ID}:${env.PIPEDRIVE_CLIENT_SECRET}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptToken(connection.refresh_token_encrypted),
    }),
  });
  const token = await parseJsonResponse<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }>(response, "Pipedrive token refresh");

  return token.access_token;
}

async function getZohoAccessToken(connection: CrmConnectionRecord) {
  const tokenEncrypted = connection.access_token_encrypted;
  const expiry = connection.token_expiry ? new Date(connection.token_expiry).getTime() : null;

  if (tokenEncrypted && (!expiry || expiry > Date.now() + 60_000)) {
    return decryptToken(tokenEncrypted);
  }

  if (!connection.refresh_token_encrypted || !env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET) {
    throw new Error("Zoho connection is missing a refresh token.");
  }

  const response = await fetch(`${getZohoAccountsBaseUrl()}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.ZOHO_CLIENT_ID,
      client_secret: env.ZOHO_CLIENT_SECRET,
      refresh_token: decryptToken(connection.refresh_token_encrypted),
    }),
  });
  const token = await parseJsonResponse<{
    access_token: string;
    expires_in?: number;
  }>(response, "Zoho token refresh");

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

async function fetchPipedriveCurrentUser(accessToken: string, apiDomain: string | null | undefined) {
  if (!apiDomain) {
    return {};
  }

  const response = await fetch(`${apiDomain}/api/v1/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return {};
  }

  const payload = (await response.json()) as {
    data?: {
      id?: number | string | null;
      name?: string | null;
      email?: string | null;
      company_name?: string | null;
    } | null;
  };

  return payload.data ?? {};
}

async function fetchZohoCurrentUser(accessToken: string, apiDomain: string | null | undefined) {
  if (!apiDomain) {
    return {};
  }

  const response = await fetch(`${apiDomain}/crm/v8/users?type=CurrentUser`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  });

  if (!response.ok) {
    return {};
  }

  const payload = (await response.json()) as {
    users?: Array<{
      id?: string | null;
      full_name?: string | null;
      email?: string | null;
      zuid?: string | null;
    }> | null;
    users_details?: Array<{
      id?: string | null;
      full_name?: string | null;
      email?: string | null;
      zuid?: string | null;
    }> | null;
    data?: Array<{
      id?: string | null;
      full_name?: string | null;
      email?: string | null;
      zuid?: string | null;
    }> | null;
  };

  return payload.users?.[0] ?? payload.users_details?.[0] ?? payload.data?.[0] ?? {};
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

async function createPipedriveNote(apiDomain: string, accessToken: string, personId: string, summary: string) {
  await parseJsonResponse(
    await fetch(`${apiDomain}/api/v1/notes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: summary,
        person_id: Number(personId),
      }),
    }),
    "Pipedrive note writeback",
  );
}

async function updatePipedrivePerson(
  apiDomain: string,
  accessToken: string,
  personId: string,
  fields: Record<string, unknown>,
) {
  await parseJsonResponse(
    await fetch(`${apiDomain}/api/v1/persons/${personId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fields),
    }),
    "Pipedrive person update",
  );
}

async function createZohoNote(
  apiDomain: string,
  accessToken: string,
  moduleName: string,
  recordId: string,
  summary: string,
) {
  await parseJsonResponse(
    await fetch(`${apiDomain}/crm/v8/Notes`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: [
          {
            Note_Title: "OutboundFlow activity",
            Note_Content: summary,
            Parent_Id: recordId,
            se_module: moduleName,
          },
        ],
      }),
    }),
    "Zoho note writeback",
  );
}

async function updateZohoRecord(
  apiDomain: string,
  accessToken: string,
  moduleName: string,
  recordId: string,
  fields: Record<string, unknown>,
) {
  await parseJsonResponse(
    await fetch(`${apiDomain}/crm/v8/${moduleName}`, {
      method: "PUT",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: [
          {
            id: recordId,
            ...fields,
          },
        ],
      }),
    }),
    "Zoho record update",
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

const pipedriveAdapter: CRMAdapter = {
  provider: "pipedrive",
  isConfigured() {
    return isPipedriveConfigured;
  },
  getConnectUrl(state, redirectUri) {
    if (!env.PIPEDRIVE_CLIENT_ID) {
      throw new Error("Pipedrive OAuth is not configured.");
    }

    const url = new URL("https://oauth.pipedrive.com/oauth/authorize");
    url.searchParams.set("client_id", env.PIPEDRIVE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", getPipedriveScopes().join(" "));
    return url.toString();
  },
  async exchangeCode(code, redirectUri) {
    const response = await fetch("https://oauth.pipedrive.com/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${env.PIPEDRIVE_CLIENT_ID ?? ""}:${env.PIPEDRIVE_CLIENT_SECRET ?? ""}`,
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    const token = await parseJsonResponse<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      api_domain?: string;
      company_domain?: string;
    }>(response, "Pipedrive token exchange");
    const apiDomain =
      token.api_domain?.replace(/\/$/, "") ||
      (token.company_domain ? `https://${token.company_domain}.pipedrive.com` : "");
    const identity = await fetchPipedriveCurrentUser(token.access_token, apiDomain || null);

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenExpiry: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
      providerAccountId: identity.id ? String(identity.id) : token.company_domain ?? null,
      providerAccountLabel: identity.company_name ?? identity.name ?? "Pipedrive",
      providerAccountEmail: identity.email ?? null,
      connectionMetadata: {
        apiDomain,
        companyDomain: token.company_domain ?? null,
        scopes: getPipedriveScopes(),
      },
    };
  },
  async refreshToken(connection) {
    const response = await fetch("https://oauth.pipedrive.com/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${env.PIPEDRIVE_CLIENT_ID ?? ""}:${env.PIPEDRIVE_CLIENT_SECRET ?? ""}`,
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connection.refresh_token_encrypted
          ? decryptToken(connection.refresh_token_encrypted)
          : "",
      }),
    });
    const token = await parseJsonResponse<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      api_domain?: string;
      company_domain?: string;
    }>(response, "Pipedrive token refresh");

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenExpiry: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
      connectionMetadata: {
        ...(connection.connection_metadata_jsonb ?? {}),
        apiDomain: token.api_domain ?? connection.connection_metadata_jsonb?.apiDomain ?? null,
        companyDomain: token.company_domain ?? connection.connection_metadata_jsonb?.companyDomain ?? null,
      },
    };
  },
  async pullSync(connection) {
    const accessToken = await getPipedriveAccessToken(connection);
    const apiDomain = String(connection.connection_metadata_jsonb?.apiDomain ?? "");

    if (!apiDomain) {
      throw new Error("Pipedrive connection is missing an API domain.");
    }

    const start = Number(connection.sync_cursor_jsonb?.start ?? 0);
    const url = new URL(`${apiDomain}/api/v1/persons`);
    url.searchParams.set("limit", "200");
    url.searchParams.set("start", String(Math.max(start, 0)));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = await parseJsonResponse<{
      data?: Array<{
        id: number | string;
        name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        email?: Array<{ value?: string | null; primary?: boolean | null }> | null;
        org_id?: { name?: string | null } | number | string | null;
      }> | null;
      additional_data?: {
        pagination?: {
          more_items_in_collection?: boolean;
          next_start?: number | null;
        } | null;
      } | null;
    }>(response, "Pipedrive person sync");

    return {
      contacts: (payload.data ?? [])
        .map((person) => {
          const primaryEmail =
            person.email?.find((entry) => entry.primary && entry.value)?.value ??
            person.email?.find((entry) => entry.value)?.value ??
            "";

          return {
            externalId: String(person.id),
            email: String(primaryEmail ?? "").trim(),
            firstName: person.first_name ?? null,
            lastName: person.last_name ?? null,
            company:
              typeof person.org_id === "object" && person.org_id
                ? person.org_id.name ?? null
                : null,
            website: null,
            jobTitle: null,
          };
        })
        .filter((contact) => Boolean(contact.email)),
      nextCursor: payload.additional_data?.pagination?.more_items_in_collection
        ? { start: payload.additional_data.pagination.next_start ?? start + 200 }
        : null,
      providerAccountId: connection.provider_account_id ?? null,
      providerAccountLabel: connection.provider_account_label ?? "Pipedrive",
      providerAccountEmail: connection.provider_account_email ?? null,
    };
  },
  async writeback(connection, payload) {
    if (!payload.externalContactId) {
      return;
    }

    const apiDomain = String(connection.connection_metadata_jsonb?.apiDomain ?? "");

    if (!apiDomain) {
      throw new Error("Pipedrive connection is missing an API domain.");
    }

    const accessToken = await getPipedriveAccessToken(connection);
    await createPipedriveNote(apiDomain, accessToken, payload.externalContactId, payload.summary);
    const statusField = String(connection.field_mapping_jsonb?.statusField ?? "").trim();

    if (statusField) {
      await updatePipedrivePerson(apiDomain, accessToken, payload.externalContactId, {
        [statusField]: payload.eventType,
      });
    }
  },
};

const zohoAdapter: CRMAdapter = {
  provider: "zoho",
  isConfigured() {
    return isZohoConfigured;
  },
  getConnectUrl(state, redirectUri) {
    if (!env.ZOHO_CLIENT_ID) {
      throw new Error("Zoho OAuth is not configured.");
    }

    const url = new URL(`${getZohoAccountsBaseUrl()}/oauth/v2/auth`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", env.ZOHO_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", getZohoScopes().join(","));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return url.toString();
  },
  async exchangeCode(code, redirectUri) {
    const response = await fetch(`${getZohoAccountsBaseUrl()}/oauth/v2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.ZOHO_CLIENT_ID ?? "",
        client_secret: env.ZOHO_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        code,
      }),
    });
    const token = await parseJsonResponse<{
      access_token: string;
      refresh_token?: string;
      api_domain?: string;
      expires_in?: number;
    }>(response, "Zoho token exchange");
    const apiDomain = token.api_domain ?? env.ZOHO_API_BASE_URL ?? "";
    const identity = await fetchZohoCurrentUser(token.access_token, apiDomain || null);

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenExpiry: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
      providerAccountId: identity.id ?? identity.zuid ?? null,
      providerAccountLabel: identity.full_name ?? "Zoho CRM",
      providerAccountEmail: identity.email ?? null,
      connectionMetadata: {
        apiDomain,
        scopes: getZohoScopes(),
      },
    };
  },
  async refreshToken(connection) {
    const response = await fetch(`${getZohoAccountsBaseUrl()}/oauth/v2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: env.ZOHO_CLIENT_ID ?? "",
        client_secret: env.ZOHO_CLIENT_SECRET ?? "",
        refresh_token: connection.refresh_token_encrypted
          ? decryptToken(connection.refresh_token_encrypted)
          : "",
      }),
    });
    const token = await parseJsonResponse<{
      access_token: string;
      expires_in?: number;
      api_domain?: string;
    }>(response, "Zoho token refresh");

    return {
      accessToken: token.access_token,
      tokenExpiry: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
      connectionMetadata: {
        ...(connection.connection_metadata_jsonb ?? {}),
        apiDomain: token.api_domain ?? connection.connection_metadata_jsonb?.apiDomain ?? env.ZOHO_API_BASE_URL ?? null,
      },
    };
  },
  async pullSync(connection) {
    const accessToken = await getZohoAccessToken(connection);
    const apiDomain = String(connection.connection_metadata_jsonb?.apiDomain ?? env.ZOHO_API_BASE_URL ?? "");

    if (!apiDomain) {
      throw new Error("Zoho connection is missing an API domain.");
    }

    const moduleName = String(connection.sync_cursor_jsonb?.module ?? "Contacts");
    const page = Number(connection.sync_cursor_jsonb?.page ?? 1);
    const fields =
      moduleName === "Leads"
        ? "Email,First_Name,Last_Name,Company,Designation,Website"
        : "Email,First_Name,Last_Name,Account_Name,Title,Website";
    const url = new URL(`${apiDomain}/crm/v8/${moduleName}`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("page", String(Math.max(page, 1)));
    url.searchParams.set("per_page", "200");

    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    });
    const payload = await parseJsonResponse<{
      data?: Array<Record<string, unknown>>;
      info?: {
        more_records?: boolean;
      } | null;
    }>(response, "Zoho contact sync");

    const contacts = (payload.data ?? [])
      .map((record) => {
        const account = record.Account_Name as { name?: string | null } | string | null | undefined;

        return {
          externalId: `${moduleName}:${String(record.id ?? "")}`,
          email: String(record.Email ?? "").trim(),
          firstName: (record.First_Name as string | null | undefined) ?? null,
          lastName: (record.Last_Name as string | null | undefined) ?? null,
          company:
            moduleName === "Leads"
              ? ((record.Company as string | null | undefined) ?? null)
              : typeof account === "object" && account
                ? account.name ?? null
                : typeof account === "string"
                  ? account
                  : null,
          website: (record.Website as string | null | undefined) ?? null,
          jobTitle:
            moduleName === "Leads"
              ? ((record.Designation as string | null | undefined) ?? null)
              : ((record.Title as string | null | undefined) ?? null),
        };
      })
      .filter((contact) => Boolean(contact.email));

    return {
      contacts,
      nextCursor: payload.info?.more_records
        ? { module: moduleName, page: page + 1 }
        : moduleName === "Contacts"
          ? { module: "Leads", page: 1 }
          : null,
      providerAccountId: connection.provider_account_id ?? null,
      providerAccountLabel: connection.provider_account_label ?? "Zoho CRM",
      providerAccountEmail: connection.provider_account_email ?? null,
    };
  },
  async writeback(connection, payload) {
    if (!payload.externalContactId) {
      return;
    }

    const [moduleName, recordId] = String(payload.externalContactId).split(":");
    const apiDomain = String(connection.connection_metadata_jsonb?.apiDomain ?? env.ZOHO_API_BASE_URL ?? "");

    if (!apiDomain || !moduleName || !recordId) {
      throw new Error("Zoho writeback is missing record metadata.");
    }

    const accessToken = await getZohoAccessToken(connection);
    await createZohoNote(apiDomain, accessToken, moduleName, recordId, payload.summary);
    const statusField = String(connection.field_mapping_jsonb?.statusField ?? "").trim();

    if (statusField) {
      await updateZohoRecord(apiDomain, accessToken, moduleName, recordId, {
        [statusField]: payload.eventType,
      });
    }
  },
};

const registry: Record<CrmProvider, CRMAdapter> = {
  custom_crm: customCrmAdapter,
  hubspot: hubspotAdapter,
  pipedrive: pipedriveAdapter,
  salesforce: salesforceAdapter,
  zoho: zohoAdapter,
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
