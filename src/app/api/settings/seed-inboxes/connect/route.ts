import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { signOAuthState } from "@/lib/auth/oauth-state";
import { createGoogleConnectUrl } from "@/services/gmail-service";

export async function GET(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can connect seed inbox monitors." }, { status: 403 });
  }

  const state = await signOAuthState({
    workspaceId: workspace.workspaceId,
    userId: workspace.userId,
    provider: "gmail",
    connectionType: "seed_inbox",
  });
  const redirectUri = new URL("/api/settings/seed-inboxes/callback", request.url).toString();

  return NextResponse.redirect(
    createGoogleConnectUrl(state, {
      redirectUri,
      scopes: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    }),
  );
}
