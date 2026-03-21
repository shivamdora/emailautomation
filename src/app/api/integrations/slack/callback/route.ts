import { NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/auth/oauth-state";
import { env, requireSlackConfiguration } from "@/lib/supabase/env";
import { storeOAuthWorkspaceIntegration } from "@/services/workspace-integration-service";

type SlackTokenResponse = {
  ok?: boolean;
  error?: string;
  access_token?: string;
  team?: {
    id?: string;
    name?: string;
  } | null;
  bot_user_id?: string;
  scope?: string;
};

export async function GET(request: Request) {
  requireSlackConfiguration();

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(new URL("/settings/integrations?integration=slack-missing-code", request.url));
    }

    const payload = await verifyOAuthState<{
      workspaceId: string;
      userId: string;
      provider: "slack";
    }>(state);
    const redirectUri = new URL("/api/integrations/slack/callback", request.url).toString();
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID ?? "",
        client_secret: env.SLACK_CLIENT_SECRET ?? "",
        code,
        redirect_uri: redirectUri,
      }),
    });
    const token = (await response.json()) as SlackTokenResponse;

    if (!response.ok || !token.ok || !token.access_token) {
      throw new Error(token.error || "Slack token exchange failed.");
    }

    await storeOAuthWorkspaceIntegration({
      workspaceId: payload.workspaceId,
      provider: "slack",
      exchange: {
        accessToken: token.access_token,
        providerAccountId: token.team?.id ?? token.bot_user_id ?? null,
        providerAccountLabel: token.team?.name ?? "Slack workspace",
        config: {
          channelId: "",
          eventTypes: [
            "campaign.replied",
            "campaign.negative_reply",
            "campaign.meeting_booked",
            "campaign.unsubscribed",
            "mailbox.approved",
            "crm.sync_failed",
          ],
          scope: token.scope ?? null,
        },
      },
    });

    return NextResponse.redirect(new URL("/settings/integrations?integration=slack-connected", request.url));
  } catch (error) {
    console.error("Slack callback failed", error);
    const message = error instanceof Error ? error.message : "slack-connect-failed";
    return NextResponse.redirect(
      new URL(`/settings/integrations?integration=slack-error&message=${encodeURIComponent(message.slice(0, 160))}`, request.url),
    );
  }
}
