"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProjectLogoForm({
  projectId,
  defaultLogoUrl,
}: {
  projectId: string;
  defaultLogoUrl?: string | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [logoUrl, setLogoUrl] = useState(defaultLogoUrl ?? "");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="glass-control grid gap-3 rounded-[1.5rem] p-4"
      onSubmit={(event) => {
        event.preventDefault();

        const form = formRef.current;
        if (!form) {
          return;
        }

        const formData = new FormData(form);

        startTransition(async () => {
          const response = await fetch(`/api/projects/${projectId}/logo`, {
            method: "POST",
            body: formData,
          });

          const payload = await response.json().catch(() => null);

          if (!response.ok) {
            toast.error(payload?.error ?? "Failed to update project logo.");
            return;
          }

          toast.success(payload?.message ?? "Project logo updated.");
          router.refresh();
        });
      }}
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold tracking-[-0.02em] text-foreground">Logo</p>
        <p className="text-sm text-muted-foreground">
          Upload a project logo or paste a hosted logo URL.
        </p>
      </div>
      <input
        type="file"
        name="logo"
        accept="image/*"
        disabled={isPending}
        className={cn(
          "glass-control h-12 rounded-[1.1rem] border-0 px-3 text-sm shadow-none file:mr-3 file:rounded-[0.9rem] file:border-0 file:bg-white/84 file:px-3 file:py-2",
          isPending ? "opacity-70" : "",
        )}
      />
      <input
        type="url"
        name="logoUrl"
        value={logoUrl}
        disabled={isPending}
        onChange={(event) => setLogoUrl(event.target.value)}
        placeholder="https://example.com/logo.png"
        className="glass-control h-12 rounded-[1.1rem] border-0 px-4 text-sm shadow-none"
      />
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Updating logo..." : "Update logo"}
      </Button>
    </form>
  );
}
