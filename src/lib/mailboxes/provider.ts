import type { MailboxProviderKey } from "@/services/mailbox-providers/types";

export const OUTLOOK_ICON_URL = "/media/microsoft-office-outlook-logo.svg";

export const mailboxProviderMeta: Record<
  MailboxProviderKey,
  {
    key: MailboxProviderKey;
    label: string;
    summary: string;
    iconUrl?: string;
  }
> = {
  gmail: {
    key: "gmail",
    label: "Gmail",
    summary: "Google Workspace or personal Gmail senders with approval gating and reply sync.",
  },
  outlook: {
    key: "outlook",
    label: "Outlook",
    summary: "Microsoft 365 or Outlook senders with Graph send, approvals, and reply sync.",
    iconUrl: OUTLOOK_ICON_URL,
  },
};

export function isMailboxProviderKey(value: string): value is MailboxProviderKey {
  return value === "gmail" || value === "outlook";
}
