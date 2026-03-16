"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, MoveRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { getBrowserPostAuthRedirectPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/client";
import { authSchema, emailOnlySchema } from "@/lib/zod/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "update-password";

type AuthCopy = {
  title: string;
  description: string;
  submitLabel: string;
  googleLabel?: string;
};

const passwordOnlySchema = z.object({
  email: z.string(),
  password: z.string().min(8),
});

function getFriendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";

  if (message.includes("Unsupported provider")) {
    return "Google sign-in is not enabled in Supabase yet. Enable the Google auth provider in your Supabase project settings, then try again.";
  }

  return message;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.31h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.1 3.56-5.2 3.56-8.66Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3A7.18 7.18 0 0 1 12 19.32a7.2 7.2 0 0 1-6.78-4.97H1.2v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.22 14.35A7.2 7.2 0 0 1 4.84 12c0-.82.14-1.61.38-2.35V6.56H1.2A12 12 0 0 0 0 12c0 1.93.46 3.76 1.2 5.44l4.02-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.36.61 4.61 1.82l3.45-3.45C17.96 1.15 15.24 0 12 0A12 12 0 0 0 1.2 6.56l4.02 3.09A7.2 7.2 0 0 1 12 4.77Z"
      />
    </svg>
  );
}

function AuthGlyph({ mode }: { mode: AuthMode }) {
  if (mode === "forgot-password" || mode === "update-password") {
    return <LockKeyhole className="size-6" />;
  }

  return <MoveRight className="size-6" />;
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const schema =
    mode === "forgot-password"
      ? emailOnlySchema
      : mode === "update-password"
        ? passwordOnlySchema
        : authSchema;
  const form = useForm<z.infer<typeof emailOnlySchema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (mode !== "update-password") {
      return;
    }

    let isActive = true;

    async function prepareRecoverySession() {
      const search = new URLSearchParams(window.location.search);
      const code = search.get("code");

      if (!code) {
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error && isActive) {
        toast.error(error.message);
      }
    }

    void prepareRecoverySession();

    return () => {
      isActive = false;
    };
  }, [mode, supabase]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      try {
        if (mode === "sign-in") {
          const {
            data: { user },
            error,
          } = await supabase.auth.signInWithPassword({
            email: values.email,
            password: values.password ?? "",
          });

          if (error) {
            throw error;
          }

          if (!user) {
            throw new Error("Authentication could not be completed. Please try again.");
          }

          const nextPath = await getBrowserPostAuthRedirectPath(supabase, user.id);
          window.location.assign(nextPath);
          return;
        }

        if (mode === "sign-up") {
          const { error } = await supabase.auth.signUp({
            email: values.email,
            password: values.password ?? "",
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });

          if (error) {
            throw error;
          }

          toast.success("Check your email for the confirmation link.");
          return;
        }

        if (mode === "update-password") {
          const { error } = await supabase.auth.updateUser({
            password: values.password ?? "",
          });

          if (error) {
            throw error;
          }

          toast.success("Password updated. Sign in with your new password.");
          window.location.assign("/sign-in");
          return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
          redirectTo: `${window.location.origin}/callback`,
        });

        if (error) {
          throw error;
        }

        toast.success("Password reset email sent.");
      } catch (error) {
        toast.error(getFriendlyAuthError(error));
      }
    });
  });

  async function handleGoogleAuth() {
    setIsGooglePending(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      toast.error(getFriendlyAuthError(error));
      setIsGooglePending(false);
    }
  }

  const copy: AuthCopy =
    mode === "sign-in"
      ? {
          title: "Sign in with email",
          description: "Access your workspace and continue where you left off.",
          submitLabel: "Sign in",
          googleLabel: "Continue with Google",
        }
      : mode === "sign-up"
        ? {
            title: "Create your account",
            description: "Start with email or Google in a few seconds.",
            submitLabel: "Create account",
            googleLabel: "Continue with Google",
          }
        : mode === "update-password"
          ? {
              title: "Set a new password",
              description: "Choose a secure password to finish recovery.",
              submitLabel: "Update password",
            }
          : {
              title: "Reset your password",
              description: "We will send a reset link to your email.",
              submitLabel: "Send reset link",
            };

  const emailError = form.formState.errors.email?.message;
  const passwordError = form.formState.errors.password?.message;

  return (
    <div className="auth-card grid gap-6 p-7 sm:p-9">
      <div className="grid gap-3 text-center">
        <div className="mx-auto flex h-[4.6rem] w-[4.6rem] items-center justify-center rounded-[24px] border border-white/70 bg-white/90 text-[#1d3342] shadow-[0_18px_42px_rgba(31,57,82,0.12)]">
          <AuthGlyph mode={mode} />
        </div>
        <div className="space-y-2">
          <h2 className="text-[2.15rem] font-semibold tracking-[-0.06em] text-[#163548]">
            {copy.title}
          </h2>
          <p className="mx-auto max-w-[24rem] text-[1.05rem] leading-8 text-[#738797]">
            {copy.description}
          </p>
        </div>
      </div>

      <form className="grid gap-4" onSubmit={onSubmit}>
        {mode !== "update-password" ? (
          <div className="grid gap-2">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#91a0ac]" />
              <Input
                id={`${mode}-email`}
                type="email"
                className="auth-input h-14 rounded-[18px] border-0 bg-[#f3f6f8] pl-11 pr-4 shadow-none"
                placeholder="Email"
                autoComplete="email"
                {...form.register("email")}
              />
            </div>
            {emailError ? <p className="text-sm text-danger">{emailError}</p> : null}
          </div>
        ) : null}

        {mode !== "forgot-password" ? (
          <div className="grid gap-2">
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#91a0ac]" />
              <Input
                id={`${mode}-password`}
                type={showPassword ? "text" : "password"}
                className="auth-input h-14 rounded-[18px] border-0 bg-[#f3f6f8] pl-11 pr-12 shadow-none"
                placeholder={
                  mode === "update-password" ? "New password" : "Password"
                }
                autoComplete={
                  mode === "update-password"
                    ? "new-password"
                    : mode === "sign-up"
                      ? "new-password"
                      : "current-password"
                }
                {...form.register("password")}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#7a92a1] transition hover:text-[#163548]"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {mode === "sign-in" ? (
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-[#2f3d48] transition hover:text-[#163548]"
                >
                  Forgot password?
                </Link>
              </div>
            ) : null}
            {passwordError ? <p className="text-sm text-danger">{passwordError}</p> : null}
          </div>
        ) : null}

        <Button
          type="submit"
          size="lg"
          disabled={isPending || isGooglePending}
          className="mt-1 h-13 rounded-[18px] bg-[#17181f] text-base text-white shadow-[0_14px_26px_rgba(23,24,31,0.2)] hover:bg-[#20232b]"
        >
          {isPending ? "Working..." : copy.submitLabel}
          {!isPending ? <MoveRight className="size-4" /> : null}
        </Button>
      </form>

      {copy.googleLabel ? (
        <div className="grid gap-4">
          <div className="auth-divider flex items-center gap-3 text-xs text-[#97a9b6]">
            <span className="h-px flex-1 border-t border-dashed border-[#dce5eb]" />
            Or sign in with
            <span className="h-px flex-1 border-t border-dashed border-[#dce5eb]" />
          </div>

          <Button
            type="button"
            disabled={isPending || isGooglePending}
            variant="outline"
            className="h-12 rounded-[18px] border border-[#e6edf2] bg-white text-[#163548] shadow-none hover:bg-[#f9fbfc]"
            onClick={() => {
              void handleGoogleAuth();
            }}
          >
            {isGooglePending ? <LoaderCircle className="size-4 animate-spin" /> : <GoogleMark />}
            {isGooglePending ? "Redirecting..." : copy.googleLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
