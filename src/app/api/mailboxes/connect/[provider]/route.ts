import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { parseDesktopReturnUrl } from "@/lib/auth/desktop-oauth";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { isMailboxProviderKey } from "@/lib/mailboxes/provider";
import { env } from "@/lib/supabase/env";
import { createMailboxConnectUrl } from "@/services/mailbox-service";

function getStateSecret() {
  if (!env.TOKEN_ENCRYPTION_KEY) {
    throw new Error("Missing TOKEN_ENCRYPTION_KEY");
  }

  return new TextEncoder().encode(env.TOKEN_ENCRYPTION_KEY);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;

  if (!isMailboxProviderKey(provider)) {
    return NextResponse.json({ error: "Unsupported mailbox provider." }, { status: 404 });
  }

  const workspace = await getWorkspaceContext();
  const desktopReturnUrl = parseDesktopReturnUrl(
    new URL(request.url).searchParams.get("desktopReturnUrl"),
  );
  const state = await new SignJWT({
    desktopReturnUrl,
    workspaceId: workspace.workspaceId,
    projectId: workspace.activeProjectId,
    userId: workspace.userId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getStateSecret());

  const redirectUri = new URL(`/api/mailboxes/callback/${provider}`, request.url).toString();

  return NextResponse.redirect(createMailboxConnectUrl(provider, state, { redirectUri }));
}
