"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { GmailMark } from "@/components/icons/gmail-mark";
import { Button } from "@/components/ui/button";
import { OUTLOOK_ICON_URL } from "@/lib/mailboxes/provider";

type MailboxConnectButtonProps = {
  label: string;
  provider: "gmail" | "outlook";
};

function getConnectHref(provider: "gmail" | "outlook") {
  return provider === "gmail" ? "/api/gmail/connect" : `/api/mailboxes/connect/${provider}`;
}

function getProviderTitle(provider: "gmail" | "outlook") {
  return provider === "gmail" ? "Gmail" : "Outlook";
}

function MailboxIcon({
  isPending,
  provider,
}: {
  isPending: boolean;
  provider: "gmail" | "outlook";
}) {
  if (isPending) {
    return <LoaderCircle className="size-5 animate-spin" />;
  }

  if (provider === "gmail") {
    return <GmailMark className="size-5" />;
  }

  return <Image src={OUTLOOK_ICON_URL} alt="" width={48} height={48} className="size-5 rounded-sm" />;
}

export function MailboxConnectButton({ label, provider }: MailboxConnectButtonProps) {
  const [isDesktop] = useState(
    () => typeof window !== "undefined" && Boolean(window.outboundFlowDesktop?.isDesktop),
  );
  const [isPending, startTransition] = useTransition();
  const providerTitle = getProviderTitle(provider);

  if (!isDesktop) {
    return (
      <Button asChild variant="outline" className="gmail-connect-button w-full sm:w-auto sm:min-w-[13rem]">
        <Link href={getConnectHref(provider)}>
          <span className="gmail-connect-button-icon">
            <MailboxIcon isPending={false} provider={provider} />
          </span>
          {label}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      className="gmail-connect-button w-full sm:w-auto sm:min-w-[13rem]"
      onClick={() => {
        startTransition(async () => {
          const result =
            (await window.outboundFlowDesktop?.connectMailbox?.(provider)) ??
            (provider === "gmail"
              ? await window.outboundFlowDesktop?.connectGmail()
              : { ok: false, error: "This desktop build does not support Outlook connection yet." });

          if (!result?.ok) {
            toast.error(result?.error ?? `Could not start the ${providerTitle} connection flow.`);
          }
        });
      }}
    >
      <span className="gmail-connect-button-icon">
        <MailboxIcon isPending={isPending} provider={provider} />
      </span>
      {label}
    </Button>
  );
}

type GmailConnectButtonProps = {
  label: string;
};

export function GmailConnectButton({ label }: GmailConnectButtonProps) {
  return <MailboxConnectButton label={label} provider="gmail" />;
}
