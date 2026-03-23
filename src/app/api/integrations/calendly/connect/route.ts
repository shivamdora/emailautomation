import { NextResponse } from "next/server";
import { signOAuthState } from "@/lib/auth/oauth-state";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { env, requireCalendlyConfiguration } from "@/lib/supabase/env";

export async function GET(request: Request) {
  requireCalendlyConfiguration();
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can connect Calendly." }, { status: 403 });
  }

  const state = await signOAuthState({
    workspaceId: workspace.workspaceId,
    userId: workspace.userId,
    provider: "calendly",
  });
  const redirectUri = new URL("/api/integrations/calendly/callback", request.url).toString();
  const url = new URL("https://auth.calendly.com/oauth/authorize");
  url.searchParams.set("client_id", env.CALENDLY_CLIENT_ID ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "default");

  return NextResponse.redirect(url);
}
