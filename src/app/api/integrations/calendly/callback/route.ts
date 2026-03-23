import { NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/auth/oauth-state";
import { env, requireCalendlyConfiguration } from "@/lib/supabase/env";
import { storeOAuthWorkspaceIntegration } from "@/services/workspace-integration-service";

type CalendlyTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

type CalendlyCurrentUserResponse = {
  resource?: {
    uri?: string | null;
    name?: string | null;
    email?: string | null;
    current_organization?: string | null;
  } | null;
};

export async function GET(request: Request) {
  requireCalendlyConfiguration();

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(new URL("/settings/integrations?integration=calendly-missing-code", request.url));
    }

    const payload = await verifyOAuthState<{
      workspaceId: string;
      userId: string;
      provider: "calendly";
    }>(state);
    const redirectUri = new URL("/api/integrations/calendly/callback", request.url).toString();
    const tokenResponse = await fetch("https://auth.calendly.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.CALENDLY_CLIENT_ID ?? "",
        client_secret: env.CALENDLY_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        code,
      }),
    });
    const token = (await tokenResponse.json()) as CalendlyTokenResponse & { error?: string };

    if (!tokenResponse.ok || !token.access_token) {
      throw new Error(token.error || "Calendly token exchange failed.");
    }

    const meResponse = await fetch("https://api.calendly.com/users/me", {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
      },
    });
    const me = (await meResponse.json()) as CalendlyCurrentUserResponse;

    await storeOAuthWorkspaceIntegration({
      workspaceId: payload.workspaceId,
      provider: "calendly",
      exchange: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? null,
        tokenExpiry: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
        providerAccountId: me.resource?.uri ?? me.resource?.current_organization ?? null,
        providerAccountLabel: me.resource?.name ?? "Calendly",
        providerAccountEmail: me.resource?.email ?? null,
        config: {
          currentOrganization: me.resource?.current_organization ?? null,
          eventTypes: ["invitee.created", "invitee.canceled"],
        },
      },
    });

    return NextResponse.redirect(new URL("/settings/integrations?integration=calendly-connected", request.url));
  } catch (error) {
    console.error("Calendly callback failed", error);
    const message = error instanceof Error ? error.message : "calendly-connect-failed";
    return NextResponse.redirect(
      new URL(`/settings/integrations?integration=calendly-error&message=${encodeURIComponent(message.slice(0, 160))}`, request.url),
    );
  }
}
