import { NextResponse } from "next/server";
import { signOAuthState } from "@/lib/auth/oauth-state";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { env, requireSlackConfiguration } from "@/lib/supabase/env";

const SLACK_SCOPES = ["chat:write", "chat:write.public"];

export async function GET(request: Request) {
  requireSlackConfiguration();
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can connect Slack." }, { status: 403 });
  }

  const state = await signOAuthState({
    workspaceId: workspace.workspaceId,
    userId: workspace.userId,
    provider: "slack",
  });
  const redirectUri = new URL("/api/integrations/slack/callback", request.url).toString();
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", env.SLACK_CLIENT_ID ?? "");
  url.searchParams.set("scope", SLACK_SCOPES.join(","));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url);
}
