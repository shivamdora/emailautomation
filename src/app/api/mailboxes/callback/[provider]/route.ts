import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { buildDesktopOAuthRedirectUrl } from "@/lib/auth/desktop-oauth";
import { isMailboxProviderKey } from "@/lib/mailboxes/provider";
import { env } from "@/lib/supabase/env";
import { logActivity } from "@/services/activity-log-service";
import { exchangeMailboxCode, storeMailboxConnection } from "@/services/mailbox-service";

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

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  let payload:
    | {
        desktopReturnUrl?: string | null;
        workspaceId: string;
        projectId: string;
        userId: string;
      }
    | null = null;

  const { provider: rawProvider } = await context.params;

  if (!isMailboxProviderKey(rawProvider)) {
    return NextResponse.redirect(
      new URL("/settings/sending?mailbox=error&message=Unsupported%20mailbox%20provider.", request.url),
    );
  }

  const provider = rawProvider;

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const redirectUri = new URL(`/api/mailboxes/callback/${provider}`, request.url).toString();

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(`/settings/sending?mailbox=missing-code&provider=${provider}`, request.url),
      );
    }

    const verified = await jwtVerify(state, getStateSecret());
    payload = verified.payload as {
      desktopReturnUrl?: string | null;
      workspaceId: string;
      projectId: string;
      userId: string;
    };
    const tokens = await exchangeMailboxCode(provider, code, { redirectUri });
    const account = await storeMailboxConnection({
      provider,
      workspaceId: payload.workspaceId,
      projectId: payload.projectId,
      userId: payload.userId,
      ...tokens,
    });

    await logActivity({
      workspaceId: payload.workspaceId,
      actorUserId: payload.userId,
      action: `${provider}.connected`,
      targetType: "mailbox_account",
      targetId: (account as { id?: string }).id ?? null,
      metadata: {
        emailAddress: tokens.emailAddress,
        provider,
      },
    });

    const desktopRedirect = buildDesktopOAuthRedirectUrl(payload.desktopReturnUrl, {
      status: "connected",
    });

    if (desktopRedirect) {
      return redirectTo(desktopRedirect);
    }

    return NextResponse.redirect(
      new URL(`/settings/sending?mailbox=connected&provider=${provider}`, request.url),
    );
  } catch (error) {
    const message =
      error instanceof Error ? encodeURIComponent(error.message.slice(0, 160)) : "unknown-error";

    console.error(`${provider} mailbox callback failed`, error);
    const desktopRedirect = buildDesktopOAuthRedirectUrl(payload?.desktopReturnUrl, {
      message,
      status: "error",
    });

    if (desktopRedirect) {
      return redirectTo(desktopRedirect);
    }

    return NextResponse.redirect(
      new URL(`/settings/sending?mailbox=error&provider=${provider}&message=${message}`, request.url),
    );
  }
}
