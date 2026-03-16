import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerPostAuthRedirectPath } from "@/lib/auth/redirects";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function buildErrorRedirect(request: NextRequest, message: string) {
  const url = new URL("/callback", request.url);
  url.searchParams.set("error_description", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return buildErrorRedirect(request, "Authentication could not be completed.");
  }

  const supabase = await createServerSupabaseClient({ canSetCookies: true });

  if (!supabase) {
    return buildErrorRedirect(request, "Supabase auth is not configured.");
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return buildErrorRedirect(request, error.message);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return buildErrorRedirect(request, "Authentication could not be completed.");
  }

  return NextResponse.redirect(new URL(await getServerPostAuthRedirectPath(user.id), request.url));
}
