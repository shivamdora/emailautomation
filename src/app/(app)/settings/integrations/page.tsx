import Link from "next/link";
import { Mail } from "lucide-react";
import { IntegrationsHub } from "@/components/settings/integrations-hub";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { type IntegrationProviderKey } from "@/lib/integrations/hub";
import { getWorkspaceIntegrationsHubData } from "@/services/integration-hub-service";

type IntegrationsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readQueryValue(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  return typeof value === "string" ? value : null;
}

function getBannerMessage(params: Record<string, string | string[] | undefined>) {
  const crmStatus = readQueryValue(params, "crm");
  const integrationStatus = readQueryValue(params, "integration");
  const rawMessage = readQueryValue(params, "message");
  const message = rawMessage ? decodeURIComponent(rawMessage) : null;

  if (crmStatus === "hubspot-connected") {
    return { tone: "success" as const, text: "HubSpot connected successfully." };
  }

  if (crmStatus === "salesforce-connected") {
    return { tone: "success" as const, text: "Salesforce connected successfully." };
  }

  if (crmStatus === "pipedrive-connected") {
    return { tone: "success" as const, text: "Pipedrive connected successfully." };
  }

  if (crmStatus === "zoho-connected") {
    return { tone: "success" as const, text: "Zoho CRM connected successfully." };
  }

  if (crmStatus === "missing-code") {
    return {
      tone: "error" as const,
      text: "The CRM callback did not include a valid authorization code.",
    };
  }

  if (crmStatus === "unsupported-provider") {
    return {
      tone: "error" as const,
      text: "That CRM provider is not supported in this flow.",
    };
  }

  if (crmStatus === "error") {
    return { tone: "error" as const, text: message || "CRM connection failed." };
  }

  if (integrationStatus === "slack-connected") {
    return {
      tone: "success" as const,
      text: "Slack connected successfully. Finish channel and alert setup in Manage.",
    };
  }

  if (integrationStatus === "calendly-connected") {
    return {
      tone: "success" as const,
      text: "Calendly connected successfully. Add the webhook signing key in Manage to complete setup.",
    };
  }

  if (integrationStatus === "slack-missing-code" || integrationStatus === "calendly-missing-code") {
    return {
      tone: "error" as const,
      text: "The OAuth callback did not include a valid authorization code.",
    };
  }

  if (integrationStatus === "slack-error" || integrationStatus === "calendly-error") {
    return {
      tone: "error" as const,
      text: message || "Integration setup failed.",
    };
  }

  return null;
}

function getInitialProvider(
  params: Record<string, string | string[] | undefined>,
): IntegrationProviderKey | null {
  const crmStatus = readQueryValue(params, "crm");
  const integrationStatus = readQueryValue(params, "integration");
  const secretProvider = readQueryValue(params, "integrationSecretProvider");

  if (secretProvider === "webhook") {
    return "webhook";
  }

  if (readQueryValue(params, "crmKey")) {
    return "custom_crm";
  }

  if (integrationStatus?.startsWith("slack")) {
    return "slack";
  }

  if (integrationStatus?.startsWith("calendly")) {
    return "calendly";
  }

  if (crmStatus?.startsWith("hubspot")) {
    return "hubspot";
  }

  if (crmStatus?.startsWith("salesforce")) {
    return "salesforce";
  }

  if (crmStatus?.startsWith("pipedrive")) {
    return "pipedrive";
  }

  if (crmStatus?.startsWith("zoho")) {
    return "zoho";
  }

  return null;
}

export default async function SettingsIntegrationsPage({
  searchParams,
}: IntegrationsPageProps) {
  const workspace = await getWorkspaceContext();
  const params = (await searchParams) ?? {};
  const canManage = ["owner", "admin"].includes(workspace.workspaceRole);
  const data = await getWorkspaceIntegrationsHubData(workspace.workspaceId);
  const banner = getBannerMessage(params);
  const initialProvider = getInitialProvider(params);
  const customCrmKey = readQueryValue(params, "crmKey");
  const customCrmWebhookSecret = readQueryValue(params, "crmWebhookSecret");
  const integrationSecret = readQueryValue(params, "integrationSecret");
  const integrationSecretProvider = readQueryValue(params, "integrationSecretProvider");

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={workspace.workspaceName}
        title="Integrations"
        description="Connect CRM sync, alerts, deliverability, mailbox discovery, and meeting workflows from one clean hub. Sender setup itself still stays on the sending page so this view remains focused and easy to manage."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/sending">
              Open sending setup
              <Mail className="size-4" />
            </Link>
          </Button>
        }
      />

      {banner ? (
        <div
          className={
            banner.tone === "error"
              ? "rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
              : "rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700"
          }
        >
          {banner.text}
        </div>
      ) : null}

      {!canManage ? (
        <div className="rounded-2xl border border-white/72 bg-white/76 px-4 py-4 text-sm text-muted-foreground">
          You can review integration health and connection history here, but owner or admin access is required to connect, reconfigure, sync, disconnect, or rotate credentials.
        </div>
      ) : null}

      {customCrmKey || customCrmWebhookSecret || integrationSecret ? (
        <Card className="border-amber-200/80 bg-amber-50/85">
          <CardHeader className="gap-2">
            <CardTitle>
              {integrationSecret
                ? "New signing secret"
                : "New custom CRM credentials"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Copy these now. Secrets and generated keys are shown once after creation or rotation, then only hints remain in the workspace.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {customCrmKey ? (
              <div className="rounded-[1.2rem] border border-amber-200/70 bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Inbound API key</p>
                <p className="mt-2 break-all font-mono text-xs text-foreground">{customCrmKey}</p>
              </div>
            ) : null}
            {customCrmWebhookSecret ? (
              <div className="rounded-[1.2rem] border border-amber-200/70 bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Webhook signing secret</p>
                <p className="mt-2 break-all font-mono text-xs text-foreground">{customCrmWebhookSecret}</p>
              </div>
            ) : null}
            {integrationSecret ? (
              <div className="rounded-[1.2rem] border border-amber-200/70 bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {integrationSecretProvider === "webhook" ? "Generic webhook signing secret" : "Integration secret"}
                </p>
                <p className="mt-2 break-all font-mono text-xs text-foreground">{integrationSecret}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <IntegrationsHub canManage={canManage} data={data} initialProvider={initialProvider} />
    </div>
  );
}
