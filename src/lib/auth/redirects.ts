import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const DASHBOARD_PATH = "/dashboard";
export const WELCOME_PATH = "/welcome";

type OnboardingState = {
  onboarding_completed_at?: string | null;
} | null;

function isMissingOnboardingColumn(message?: string | null) {
  return typeof message === "string" && message.includes("onboarding_completed_at");
}

function isOnboardingComplete(profile: OnboardingState) {
  return Boolean(profile?.onboarding_completed_at);
}

export function getPostAuthRedirectPathFromProfile(profile: OnboardingState) {
  return isOnboardingComplete(profile) ? DASHBOARD_PATH : WELCOME_PATH;
}

export async function getServerPostAuthRedirectPath(userId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: rawProfile, error } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();

  if (isMissingOnboardingColumn(error?.message)) {
    return DASHBOARD_PATH;
  }

  return getPostAuthRedirectPathFromProfile(rawProfile as OnboardingState);
}

export async function getBrowserPostAuthRedirectPath(
  supabase: Pick<SupabaseClient, "from">,
  userId: string,
) {
  const { data: rawProfile, error } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();

  if (isMissingOnboardingColumn(error?.message)) {
    return DASHBOARD_PATH;
  }

  return getPostAuthRedirectPathFromProfile(rawProfile as OnboardingState);
}
