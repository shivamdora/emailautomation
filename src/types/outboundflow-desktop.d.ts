type DesktopGmailConnectResult = {
  ok: boolean;
  error?: string;
};

type OutboundFlowDesktopBridge = {
  connectMailbox: (provider: "gmail" | "outlook") => Promise<DesktopGmailConnectResult>;
  connectGmail: () => Promise<DesktopGmailConnectResult>;
  isDesktop: boolean;
  version: string;
};

declare global {
  interface Window {
    outboundFlowDesktop?: OutboundFlowDesktopBridge;
  }
}

export {};
