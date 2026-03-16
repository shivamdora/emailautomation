"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getBrowserPostAuthRedirectPath } from "@/lib/auth/redirects";
import { Button } from "@/components/ui/button";

function decodeMessage(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

export function CallbackStatus() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function finishAuthentication() {
      try {
        const supabase = createClient();
        const search = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const type = search.get("type") ?? hash.get("type");
        const errorMessage =
          decodeMessage(search.get("error_description")) ??
          decodeMessage(hash.get("error_description")) ??
          decodeMessage(search.get("error")) ??
          decodeMessage(hash.get("error"));

        if (errorMessage) {
          throw new Error(errorMessage);
        }

        if (type === "recovery") {
          const recoveryQuery = new URLSearchParams(window.location.search);
          recoveryQuery.set("mode", "update");
          const hashSuffix = window.location.hash || "";
          window.location.replace(`/forgot-password?${recoveryQuery.toString()}${hashSuffix}`);
          return;
        }

        const code = search.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error("Authentication could not be completed. Please try again.");
        }

        const nextPath = await getBrowserPostAuthRedirectPath(supabase, user.id);
        window.location.replace(nextPath);
      } catch (caughtError) {
        if (!isActive) {
          return;
        }

        const message =
          caughtError instanceof Error ? caughtError.message : "Authentication failed";
        setError(message);
      }
    }

    void finishAuthentication();

    return () => {
      isActive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="grid gap-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          <AlertCircle className="size-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#163548]">
            Authentication failed
          </h2>
          <p className="text-sm leading-6 text-[#6d7f8b]">{error}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-11 flex-1 rounded-2xl bg-[#163548] text-white hover:bg-[#1d4359]">
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 flex-1 rounded-2xl border-white/65 bg-white/70 hover:bg-white">
            <Link href="/sign-up">Create account</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#163548]/8 text-[#163548]">
        <LoaderCircle className="size-6 animate-spin" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#163548]">
          Finishing your sign-in
        </h2>
        <p className="text-sm leading-6 text-[#6d7f8b]">
          We are securing your session and sending you to the right workspace screen.
        </p>
      </div>
    </div>
  );
}
