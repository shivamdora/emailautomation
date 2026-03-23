"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { productContent } from "@/content/product";
import { Button } from "@/components/ui/button";

export function LiveRefresh({
  autoRefresh = false,
  intervalMs = 60000,
  label = "Auto refresh while active",
  syncEndpoint,
}: {
  autoRefresh?: boolean;
  intervalMs?: number;
  label?: string;
  syncEndpoint?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSyncing, setIsSyncing] = useState(false);

  async function syncAndRefresh() {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    if (syncEndpoint) {
      setIsSyncing(true);

      try {
        await fetch(syncEndpoint, {
          method: "POST",
        });
      } catch {
        // Refresh the view even if the sync request fails so the UI stays usable.
      } finally {
        setIsSyncing(false);
      }
    }

    startTransition(() => {
      router.refresh();
    });
  }

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    };

    const intervalId = window.setInterval(() => {
      refreshIfVisible();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshIfVisible();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoRefresh, intervalMs, router, startTransition]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="glass-chip rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending || isSyncing}
        onClick={() => {
          void syncAndRefresh();
        }}
      >
        {isPending || isSyncing
          ? productContent.shared.liveRefresh.syncing
          : productContent.shared.liveRefresh.syncNow}
      </Button>
    </div>
  );
}
