import { redirect } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { WelcomeForm } from "@/components/forms/welcome-form";
import { getServerPostAuthRedirectPath } from "@/lib/auth/redirects";
import { requireSessionUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function WelcomePage() {
  const user = await requireSessionUser();
  const nextPath = await getServerPostAuthRedirectPath(user.id);

  if (nextPath !== "/welcome") {
    redirect(nextPath);
  }

  const supabase = createAdminSupabaseClient();
  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("full_name, title")
    .eq("id", user.id)
    .maybeSingle();

  const profile = rawProfile as { full_name?: string | null; title?: string | null } | null;

  return (
    <main className="auth-page-shell relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="auth-page-orb auth-page-orb-left" />
      <div className="auth-page-orb auth-page-orb-right" />
      <div className="auth-page-orb auth-page-orb-bottom" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl items-center justify-center">
        <AuthShell
          badge="Welcome setup"
          title="Finish your profile before you step into the dashboard."
          description="This quick setup keeps your workspace cleaner for team visibility, contact ownership, and Gmail-based activity."
          caption="One lightweight step now keeps the rest of your outbound workspace more organized."
        >
          <div className="auth-card grid gap-6 p-7 sm:p-8">
            <div className="grid gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#163548]/8 text-[#163548] shadow-[0_18px_42px_rgba(22,53,72,0.08)]">
                <Sparkles className="size-7" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[#163548]">
                  Tell us who is behind this workspace
                </h2>
                <p className="text-sm leading-6 text-[#6d7f8b]">
                  We will use this on your personal profile now, and you can refine additional
                  settings later inside the app.
                </p>
              </div>
            </div>

            <WelcomeForm
              defaultValues={{
                fullName:
                  profile?.full_name ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "",
                title: profile?.title ?? "",
              }}
            />

            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#8aa0b0]">
              <ArrowRight className="size-3.5" />
              Next stop: dashboard
            </div>
          </div>
        </AuthShell>
      </div>
    </main>
  );
}
