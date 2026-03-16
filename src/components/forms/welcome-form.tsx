"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { profileSchema } from "@/lib/zod/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getApiErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "fieldErrors" in error &&
    typeof error.fieldErrors === "object" &&
    error.fieldErrors
  ) {
    const entries = Object.values(error.fieldErrors as Record<string, unknown>).flat();
    const firstMessage = entries.find((entry) => typeof entry === "string");
    if (typeof firstMessage === "string") {
      return firstMessage;
    }
  }

  return "Failed to save your profile";
}

export function WelcomeForm({
  defaultValues,
}: {
  defaultValues: z.infer<typeof profileSchema>;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          markOnboardingComplete: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        toast.error(getApiErrorMessage(error?.error));
        return;
      }

      toast.success("Profile saved");
      window.location.assign("/dashboard");
    });
  });

  const fullNameError = form.formState.errors.fullName?.message;
  const titleError = form.formState.errors.title?.message;

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="welcome-full-name" className="text-sm font-medium text-[#355365]">
          Full name
        </Label>
        <Input
          id="welcome-full-name"
          className="auth-input"
          placeholder="Jane Doe"
          autoComplete="name"
          {...form.register("fullName")}
        />
        {fullNameError ? <p className="text-sm text-danger">{fullNameError}</p> : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="welcome-title" className="text-sm font-medium text-[#355365]">
          Title
        </Label>
        <Input
          id="welcome-title"
          className="auth-input"
          placeholder="Founder"
          autoComplete="organization-title"
          {...form.register("title")}
        />
        {titleError ? <p className="text-sm text-danger">{titleError}</p> : null}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="mt-2 h-12 rounded-2xl bg-[#163548] text-white shadow-[0_22px_48px_rgba(22,53,72,0.26)] hover:bg-[#1d4359]"
      >
        {isPending ? "Saving..." : "Continue to dashboard"}
        {!isPending ? <ArrowRight className="size-4" /> : null}
      </Button>
    </form>
  );
}
