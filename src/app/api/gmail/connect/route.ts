import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { parseDesktopReturnUrl } from "@/lib/auth/desktop-oauth";
import { createGoogleConnectUrl } from "@/services/gmail-service";
import { env, requireGoogleConfiguration } from "@/lib/supabase/env";

function getStateSecret() {
  if (!env.TOKEN_ENCRYPTION_KEY) {
    throw new Error("Missing TOKEN_ENCRYPTION_KEY");
  }

  return new TextEncoder().encode(env.TOKEN_ENCRYPTION_KEY);
}

export async function GET(request: Request) {
  requireGoogleConfiguration();

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

  const redirectUri = new URL("/api/gmail/callback", request.url).toString();

  return NextResponse.redirect(createGoogleConnectUrl(state, { redirectUri }));
}
