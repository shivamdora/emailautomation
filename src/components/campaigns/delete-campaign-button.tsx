"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

type DeleteCampaignButtonProps = {
  campaignId: string;
  redirectTo?: string;
} & Omit<ButtonProps, "onClick">;

export function DeleteCampaignButton({
  campaignId,
  redirectTo = "/campaigns",
  ...buttonProps
}: DeleteCampaignButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Delete this campaign and its queued/send history?")) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(typeof payload?.error === "string" ? payload.error : "Failed to delete campaign");
        return;
      }

      toast.success("Campaign deleted");
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <Button
      {...buttonProps}
      type="button"
      variant={buttonProps.variant ?? "danger"}
      disabled={buttonProps.disabled || isPending}
      onClick={handleClick}
    >
      {isPending ? "Deleting..." : "Delete"}
    </Button>
  );
}
