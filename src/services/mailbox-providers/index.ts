import { GmailMailboxProvider } from "@/services/mailbox-providers/gmail/provider";
import { OutlookMailboxProvider } from "@/services/mailbox-providers/outlook/provider";
import type { MailboxProvider, MailboxProviderKey } from "@/services/mailbox-providers/types";

export function getMailboxProvider(provider: MailboxProviderKey | string): MailboxProvider {
  if (provider === "gmail") {
    return new GmailMailboxProvider();
  }

  if (provider === "outlook") {
    return new OutlookMailboxProvider();
  }

  throw new Error(`Unsupported mailbox provider: ${provider}`);
}
