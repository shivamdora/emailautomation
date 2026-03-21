import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { buildDesktopOAuthRedirectUrl } from "@/lib/auth/desktop-oauth";
import { exchangeGoogleCode, storeGmailConnection } from "@/services/gmail-service";
import { env } from "@/lib/supabase/env";
import { logActivity } from "@/services/activity-log-service";

function getStateSecret() {
  if (!env.TOKEN_ENCRYPTION_KEY) {
    throw new Error("Missing TOKEN_ENCRYPTION_KEY");
  }

  return new TextEncoder().encode(env.TOKEN_ENCRYPTION_KEY);
}

function redirectTo(location: string) {
  return new NextResponse(null, {
    headers: {
      Location: location,
    },
    status: 302,
  });
}

export async function GET(request: Request) {
  let payload:
    | {
        desktopReturnUrl?: string | null;
        workspaceId: string;
        projectId: string;
        userId: string;
      }
    | null = null;

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const redirectUri = new URL("/api/gmail/callback", request.url).toString();

    if (!code || !state) {
      return NextResponse.redirect(new URL("/settings/sending?gmail=missing-code", request.url));
    }

    const verified = await jwtVerify(state, getStateSecret());
    payload = verified.payload as {
        desktopReturnUrl?: string | null;
        workspaceId: string;
        projectId: string;
        userId: string;
      };
    const tokens = await exchangeGoogleCode(code, { redirectUri });
    const account = await storeGmailConnection({
      workspaceId: payload.workspaceId,
      projectId: payload.projectId,
      userId: payload.userId,
      ...tokens,
    });

    await logActivity({
      workspaceId: payload.workspaceId,
      actorUserId: payload.userId,
      action: "gmail.connected",
      targetType: "gmail_account",
      targetId: (account as { id?: string }).id ?? null,
      metadata: { emailAddress: tokens.emailAddress },
    });

    const desktopRedirect = buildDesktopOAuthRedirectUrl(payload.desktopReturnUrl, {
      status: "connected",
    });

    if (desktopRedirect) {
      return redirectTo(desktopRedirect);
    }

    return NextResponse.redirect(new URL("/settings/sending?gmail=connected", request.url));
  } catch (error) {
    const message =
      error instanceof Error ? encodeURIComponent(error.message.slice(0, 160)) : "unknown-error";

    console.error("Gmail callback failed", error);
    const desktopRedirect = buildDesktopOAuthRedirectUrl(payload?.desktopReturnUrl, {
      message,
      status: "error",
    });

    if (desktopRedirect) {
      return redirectTo(desktopRedirect);
    }

    return NextResponse.redirect(new URL(`/settings/sending?gmail=error&message=${message}`, request.url));
  }
}
