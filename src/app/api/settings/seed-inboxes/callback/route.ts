import { NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/auth/oauth-state";
import { exchangeGoogleCode } from "@/services/gmail-service";
import { storeSeedInboxConnection } from "@/services/seed-monitor-service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(new URL("/settings/advanced?seedInbox=missing-code", request.url));
    }

    const payload = await verifyOAuthState<{
      workspaceId: string;
      userId: string;
      provider: string;
      connectionType: string;
    }>(state);
    const redirectUri = new URL("/api/settings/seed-inboxes/callback", request.url).toString();
    const tokens = await exchangeGoogleCode(code, { redirectUri });

    await storeSeedInboxConnection({
      workspaceId: payload.workspaceId,
      userId: payload.userId,
      provider: "gmail",
      emailAddress: tokens.emailAddress,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiry: tokens.tokenExpiry,
    });

    return NextResponse.redirect(new URL("/settings/advanced?seedInbox=connected", request.url));
  } catch (error) {
    console.error("Seed inbox callback failed", error);
    const message = error instanceof Error ? error.message : "seed-inbox-connect-failed";
    return NextResponse.redirect(
      new URL(`/settings/advanced?seedInbox=error&message=${encodeURIComponent(message.slice(0, 160))}`, request.url),
    );
  }
}
