"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import {
  BellRing,
  Cable,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  KeyRound,
  Link2,
  Mail,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import {
  type IntegrationHubConnectionItem,
  type IntegrationHubTile,
  type IntegrationProviderKey,
  type IntegrationsHubData,
} from "@/lib/integrations/hub";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type IntegrationsHubProps = {
  canManage: boolean;
  data: IntegrationsHubData;
  initialProvider?: IntegrationProviderKey | null;
};

const workspaceEventOptions = [
  { value: "campaign.replied", label: "Reply alerts" },
  { value: "campaign.negative_reply", label: "Negative reply alerts" },
  { value: "campaign.meeting_booked", label: "Meeting booked alerts" },
  { value: "campaign.unsubscribed", label: "Unsubscribe alerts" },
  { value: "mailbox.approved", label: "Mailbox approval alerts" },
  { value: "crm.sync_failed", label: "CRM sync failures" },
] as const;

const calendlyEventOptions = [
  { value: "invitee.created", label: "Meeting booked" },
  { value: "invitee.canceled", label: "Meeting canceled" },
] as const;

function formatDateTime(value?: string | null) {
  if (!value) {
    return "No activity yet";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getTileStatusLabel(status: IntegrationHubTile["status"]) {
  switch (status) {
    case "connected":
      return "Connected";
    case "error":
      return "Error";
    case "disconnected":
      return "Disconnected";
    default:
      return "Available";
  }
}

function getBadgeVariantForTileStatus(status: IntegrationHubTile["status"]) {
  switch (status) {
    case "connected":
      return "success" as const;
    case "error":
      return "danger" as const;
    case "disconnected":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

function getHealthLabel(health: IntegrationHubConnectionItem["health"]) {
  switch (health) {
    case "healthy":
      return "Healthy";
    case "needs_attention":
      return "Needs attention";
    default:
      return "Error";
  }
}

function getHealthBadgeVariant(health: IntegrationHubConnectionItem["health"]) {
  switch (health) {
    case "healthy":
      return "success" as const;
    case "needs_attention":
      return "warning" as const;
    default:
      return "danger" as const;
  }
}

function getActivityLabel(kind: IntegrationHubConnectionItem["lastActivityKind"]) {
  switch (kind) {
    case "sync":
      return "Last sync";
    case "writeback":
      return "Last writeback";
    case "event":
      return "Last event";
    case "activity":
      return "Last activity";
    default:
      return "Last activity";
  }
}

function getProviderIcon(icon: IntegrationHubTile["icon"], className?: string) {
  const iconClassName = cn("size-5", className);

  switch (icon) {
    case "automation":
      return <BellRing className={iconClassName} />;
    case "calendar":
      return <CalendarDays className={iconClassName} />;
    case "shield":
      return <ShieldCheck className={iconClassName} />;
    case "custom":
      return <KeyRound className={iconClassName} />;
    case "mail":
      return <Mail className={iconClassName} />;
    default:
      return <Cable className={iconClassName} />;
  }
}

function renderProviderIcon(tile: IntegrationHubTile, className?: string) {
  if (tile.iconUrl) {
    return (
      <Image
        src={tile.iconUrl}
        alt=""
        width={48}
        height={48}
        className={cn("size-5 rounded-sm", className)}
      />
    );
  }

  return getProviderIcon(tile.icon, className);
}

function getTileCtaLabel(tile: IntegrationHubTile) {
  if (tile.category === "mailboxes") {
    return "Open sending";
  }

  if (tile.status === "connected") {
    return "Manage";
  }

  if (tile.status === "error") {
    return "Fix setup";
  }

  if (tile.status === "disconnected") {
    return "Reconnect";
  }

  return tile.authType === "oauth" ? "Connect" : "Configure";
}

function getMailboxSummaryLabel(data: IntegrationsHubData["mailboxSummary"]) {
  if (data.readyCount > 0) {
    return `${data.readyCount} ready`;
  }

  if (data.totalCount > 0) {
    return `${data.pendingCount} pending`;
  }

  return "Not started";
}

function parseStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function OverviewCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Card className="border border-white/76 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(243,248,252,0.88))]">
      <CardContent className="grid gap-3 p-5 sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        <div className="space-y-1">
          <p className="text-3xl font-semibold tracking-[-0.06em] text-foreground">{value}</p>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCard({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="border border-white/76 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,249,252,0.88))]">
      <CardHeader className="gap-3 border-b border-white/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {aside}
        </div>
      </CardHeader>
      <CardContent className="p-5 sm:p-6">{children}</CardContent>
    </Card>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-[1.4rem] border border-white/70 bg-white/68 p-4 sm:p-5">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="glass-control h-12 rounded-[1.05rem] border-0 px-4 text-sm shadow-none"
      />
    </label>
  );
}

function CheckboxList({
  name,
  options,
  selectedValues,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  selectedValues: string[];
}) {
  return (
    <div className="grid gap-2">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex items-center gap-3 rounded-[1rem] border border-white/68 bg-white/80 px-3.5 py-3 text-sm text-foreground"
        >
          <input
            type="checkbox"
            name={name}
            value={option.value}
            defaultChecked={selectedValues.includes(option.value)}
            className="size-4 rounded border-slate-300"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function ConnectionMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 rounded-[1rem] border border-white/65 bg-white/76 px-3.5 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="break-all text-sm text-foreground">{value}</p>
    </div>
  );
}

function IntegrationDialog({
  canManage,
  onClose,
  connectionItems,
  open,
  tile,
}: {
  canManage: boolean;
  onClose: () => void;
  connectionItems: IntegrationHubConnectionItem[];
  open: boolean;
  tile: IntegrationHubTile | null;
}) {
  const liveConnections = useMemo(
    () => connectionItems.filter((connection) => connection.status !== "disconnected"),
    [connectionItems],
  );
  const previousConnections = useMemo(
    () => connectionItems.filter((connection) => connection.status === "disconnected"),
    [connectionItems],
  );

  if (!tile) {
    return null;
  }

  const firstLiveConnection = liveConnections[0] ?? null;
  const workspaceEventDefaults = parseStringList(firstLiveConnection?.config?.eventTypes);
  const calendlyEventDefaults =
    workspaceEventDefaults.length > 0 ? workspaceEventDefaults : calendlyEventOptions.map((option) => option.value);
  const slackChannelId =
    tile.provider === "slack" && typeof firstLiveConnection?.config?.channelId === "string"
      ? firstLiveConnection.config.channelId
      : "";
  const webhookUrl =
    tile.provider === "webhook" && typeof firstLiveConnection?.config?.webhookUrl === "string"
      ? firstLiveConnection.config.webhookUrl
      : "";
  const hunterVerifyOnImport = Boolean(firstLiveConnection?.config?.verifyOnImport);
  const hunterPreLaunchRule =
    firstLiveConnection?.config?.preLaunchRule === "block_invalid" ? "block_invalid" : "warn_only";
  const isMailboxTile = tile.category === "mailboxes";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:w-[min(92vw,78rem)]">
        <div className="grid max-h-[88vh] grid-rows-[auto,1fr] overflow-hidden">
          <div className="border-b border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,249,252,0.92))] px-6 pb-5 pt-6 sm:px-7">
            <DialogHeader className="gap-4 pr-14">
              <div className="flex flex-wrap items-start gap-4">
                <span className="flex size-12 items-center justify-center rounded-[1.2rem] border border-white/74 bg-[rgba(230,242,247,0.9)] text-accent-foreground">
                  {renderProviderIcon(tile)}
                </span>
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="text-2xl tracking-[-0.05em]">{tile.title}</DialogTitle>
                    <Badge variant={getBadgeVariantForTileStatus(tile.status)}>
                      {getTileStatusLabel(tile.status)}
                    </Badge>
                  </div>
                  <DialogDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    {tile.shortValue}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto px-6 py-6 sm:px-7">
            <div className="grid gap-5">
              <FormSection
                title="Overview"
                description="This is the current provider state for this workspace and the operational summary that should stay easy to scan."
              >
                <div className="grid gap-3 md:grid-cols-3">
                  <ConnectionMeta
                    label="Category"
                    value={
                      tile.category === "crm_sync"
                        ? "CRM Sync"
                        : tile.category === "automation_alerts"
                          ? "Automation & Alerts"
                        : tile.category === "deliverability"
                            ? "Deliverability"
                            : tile.category === "mailboxes"
                              ? "Mailboxes"
                            : "Meetings"
                    }
                  />
                  <ConnectionMeta
                    label="Connections"
                    value={
                      isMailboxTile
                        ? tile.connectionCount
                          ? String(tile.connectionCount)
                          : tile.connectionSummary === "Previously connected"
                            ? "Previously connected"
                            : "Not connected yet"
                        : liveConnections.length
                          ? String(liveConnections.length)
                          : previousConnections.length
                            ? "Previously connected"
                            : "Not connected yet"
                    }
                  />
                  <ConnectionMeta
                    label="Primary account"
                    value={firstLiveConnection?.accountLabel ?? tile.primaryAccountLabel ?? "Not connected yet"}
                  />
                </div>

                {firstLiveConnection ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <ConnectionMeta label="Health" value={getHealthLabel(firstLiveConnection.health)} />
                    <ConnectionMeta
                      label={getActivityLabel(firstLiveConnection.lastActivityKind)}
                      value={formatDateTime(firstLiveConnection.lastActivityAt)}
                    />
                    {firstLiveConnection.keyHint ? (
                      <ConnectionMeta label="Key hint" value={`Ends in ${firstLiveConnection.keyHint}`} />
                    ) : null}
                    {firstLiveConnection.secretHint ? (
                      <ConnectionMeta label="Secret hint" value={`Ends in ${firstLiveConnection.secretHint}`} />
                    ) : null}
                    {firstLiveConnection.webhookUrl ? (
                      <ConnectionMeta label="Endpoint" value={firstLiveConnection.webhookUrl} />
                    ) : null}
                    {firstLiveConnection.lastError ? (
                      <ConnectionMeta label="Attention" value={firstLiveConnection.lastError} />
                    ) : null}
                  </div>
                ) : isMailboxTile && tile.primaryHealth ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <ConnectionMeta
                      label="Health"
                      value={tile.primaryHealth === "healthy" ? "Healthy" : "Needs attention"}
                    />
                    <ConnectionMeta
                      label="Mailbox state"
                      value={tile.connectionSummary ?? "Not connected yet"}
                    />
                  </div>
                ) : null}
              </FormSection>

              <FormSection
                title="What syncs / what triggers"
                description="The page stays compact because behavior details live in this dialog instead of inline cards and forms."
              >
                <p className="text-sm leading-6 text-foreground">{tile.enables}</p>
                <div className="flex flex-wrap gap-2">
                  {tile.capabilityTags.map((tag) => (
                    <Badge key={tag} variant="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </FormSection>

              <FormSection
                title="Customer requirements and pricing note"
                description="The connector is free to add here. Any paid plan or usage cost remains on the customer side."
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <ConnectionMeta label="Requirement" value={tile.customerRequirement} />
                  <ConnectionMeta label="Auth mode" value={tile.authType.replaceAll("_", " ")} />
                </div>
                {tile.provider === "calendly" ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Calendly setup needs both OAuth and the customer&apos;s webhook signing key. Mailboxes still stay on the
                    sending page by design.
                  </p>
                ) : null}
                {isMailboxTile ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Gmail and Outlook appear here for discovery, but the actual sender connection, approval, and disconnect flow stays on the sending page.
                  </p>
                ) : null}
              </FormSection>

              <FormSection
                title="Connect / configure"
                description="Setup happens here so the main integrations page stays readable even when more providers are added."
              >
                {!canManage ? (
                  <div className="rounded-[1.1rem] border border-white/70 bg-white/76 px-4 py-3 text-sm text-muted-foreground">
                    Only workspace owners and admins can connect or reconfigure integrations.
                  </div>
                ) : null}

                {canManage && (
                  <div className="grid gap-4">
                    {isMailboxTile ? (
                      <DialogFooter className="justify-end">
                        <Button asChild>
                          <Link href="/settings/sending">
                            Open sending setup
                            <Link2 className="size-4" />
                          </Link>
                        </Button>
                      </DialogFooter>
                    ) : null}

                    {(tile.provider === "hubspot" ||
                      tile.provider === "salesforce" ||
                      tile.provider === "pipedrive" ||
                      tile.provider === "zoho") && (
                      <div className="flex flex-wrap items-center gap-3">
                        <Button asChild>
                          <Link href={`/api/crm/connect/${tile.provider}`}>
                            {tile.status === "connected" ? "Reconnect" : "Connect"}
                          </Link>
                        </Button>
                        {firstLiveConnection ? (
                          <form action="/api/crm/sync" method="post">
                            <input type="hidden" name="connectionId" value={firstLiveConnection.id} />
                            <Button type="submit" variant="secondary">
                              <RefreshCcw className="size-4" />
                              Sync now
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    )}

                    {tile.provider === "custom_crm" && (
                      <div className="grid gap-4">
                        {liveConnections.map((connection) => (
                          <div
                            key={connection.id}
                            className="grid gap-4 rounded-[1.2rem] border border-white/68 bg-white/76 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">{connection.accountLabel}</p>
                                <p className="text-sm text-muted-foreground">
                                  {connection.keyHint ? `API key ends in ${connection.keyHint}` : "Managed API key"}
                                </p>
                              </div>
                              <form action="/api/settings/crm/custom" method="post">
                                <input type="hidden" name="action" value="rotate_key" />
                                <input type="hidden" name="connectionId" value={connection.id} />
                                <Button type="submit" variant="secondary" size="sm">
                                  Rotate key
                                </Button>
                              </form>
                            </div>

                            <form
                              id={`custom-crm-${connection.id}`}
                              action="/api/settings/crm/custom"
                              method="post"
                              className="grid gap-3"
                            >
                              <input type="hidden" name="action" value="update_webhook" />
                              <input type="hidden" name="connectionId" value={connection.id} />
                              <TextField
                                label="Webhook URL"
                                name="outboundWebhookUrl"
                                type="url"
                                defaultValue={connection.webhookUrl}
                                placeholder="https://crm.example.com/outboundflow/events"
                              />
                            </form>
                            <DialogFooter className="justify-between">
                              <form action="/api/crm/disconnect" method="post">
                                <input type="hidden" name="connectionId" value={connection.id} />
                                <Button type="submit" variant="outline">
                                  Disconnect
                                </Button>
                              </form>
                              <Button type="submit" form={`custom-crm-${connection.id}`}>
                                Save webhook
                              </Button>
                            </DialogFooter>
                          </div>
                        ))}
                      </div>
                    )}

                    {tile.provider === "custom_crm" && (
                      <form action="/api/settings/crm/custom" method="post" className="grid gap-3">
                        <TextField
                          label="Connection label"
                          name="providerAccountLabel"
                          defaultValue=""
                          placeholder="Acme internal CRM"
                          required
                        />
                        <TextField
                          label="Webhook URL"
                          name="outboundWebhookUrl"
                          type="url"
                          placeholder="https://crm.example.com/outboundflow/events"
                        />
                        <DialogFooter>
                          <Button type="submit">Create custom CRM</Button>
                        </DialogFooter>
                      </form>
                    )}

                    {tile.provider === "slack" && !firstLiveConnection ? (
                      <Button asChild className="w-fit">
                        <Link href="/api/integrations/slack/connect">Connect Slack</Link>
                      </Button>
                    ) : null}

                    {tile.provider === "slack" && firstLiveConnection ? (
                      <>
                        <form
                          id="slack-config-form"
                          action="/api/integrations/slack/configure"
                          method="post"
                          className="grid gap-3"
                        >
                          <TextField
                            label="Channel ID"
                            name="channelId"
                            defaultValue={slackChannelId}
                            placeholder="C0123456789"
                            required
                          />
                          <div className="grid gap-2">
                            <p className="text-sm font-medium text-foreground">Alert types</p>
                            <CheckboxList
                              name="eventTypes"
                              options={workspaceEventOptions}
                              selectedValues={
                                workspaceEventDefaults.length
                                  ? workspaceEventDefaults
                                  : workspaceEventOptions.map((option) => option.value)
                              }
                            />
                          </div>
                        </form>
                        <DialogFooter className="justify-between">
                          <form action="/api/integrations/disconnect" method="post">
                            <input type="hidden" name="integrationId" value={firstLiveConnection.id} />
                            <Button type="submit" variant="outline">
                              Disconnect
                            </Button>
                          </form>
                          <Button type="submit" form="slack-config-form">
                            Save Slack settings
                          </Button>
                        </DialogFooter>
                      </>
                    ) : null}

                    {tile.provider === "webhook" ? (
                      <>
                        <form
                          id="webhook-config-form"
                          action="/api/integrations/webhook/save"
                          method="post"
                          className="grid gap-3"
                        >
                          <TextField
                            label="Webhook URL"
                            name="webhookUrl"
                            type="url"
                            defaultValue={webhookUrl}
                            placeholder="https://hooks.example.com/outboundflow"
                            required
                          />
                          <div className="grid gap-2">
                            <p className="text-sm font-medium text-foreground">Forward these events</p>
                            <CheckboxList
                              name="eventTypes"
                              options={workspaceEventOptions}
                              selectedValues={
                                workspaceEventDefaults.length
                                  ? workspaceEventDefaults
                                  : workspaceEventOptions.map((option) => option.value)
                              }
                            />
                          </div>
                        </form>
                        <DialogFooter className="justify-between">
                          {firstLiveConnection ? (
                            <form action="/api/integrations/disconnect" method="post">
                              <input type="hidden" name="integrationId" value={firstLiveConnection.id} />
                              <Button type="submit" variant="outline">
                                Disconnect
                              </Button>
                            </form>
                          ) : (
                            <span />
                          )}
                          <Button type="submit" form="webhook-config-form">
                            {firstLiveConnection ? "Update webhook" : "Save webhook"}
                          </Button>
                        </DialogFooter>
                      </>
                    ) : null}

                    {tile.provider === "hunter" ? (
                      <>
                        <form
                          id="hunter-config-form"
                          action="/api/integrations/hunter/save"
                          method="post"
                          className="grid gap-3"
                        >
                          <TextField
                            label="Hunter API key"
                            name="apiKey"
                            placeholder={
                              firstLiveConnection?.keyHint
                                ? `Current key ends in ${firstLiveConnection.keyHint}`
                                : "hunter_api_key"
                            }
                            required
                          />
                          <label className="flex items-center gap-3 rounded-[1rem] border border-white/68 bg-white/80 px-3.5 py-3 text-sm text-foreground">
                            <input
                              type="checkbox"
                              name="verifyOnImport"
                              value="true"
                              defaultChecked={hunterVerifyOnImport}
                              className="size-4 rounded border-slate-300"
                            />
                            <span>Verify contacts during import</span>
                          </label>
                          <label className="grid gap-2 text-sm">
                            <span className="font-medium text-foreground">Pre-launch rule</span>
                            <select
                              name="preLaunchRule"
                              defaultValue={hunterPreLaunchRule}
                              className="glass-control h-12 rounded-[1.05rem] border-0 px-4 text-sm shadow-none"
                            >
                              <option value="warn_only">Warn only</option>
                              <option value="block_invalid">Block invalid contacts</option>
                            </select>
                          </label>
                        </form>
                        <DialogFooter className="justify-between">
                          {firstLiveConnection ? (
                            <form action="/api/integrations/disconnect" method="post">
                              <input type="hidden" name="integrationId" value={firstLiveConnection.id} />
                              <Button type="submit" variant="outline">
                                Disconnect
                              </Button>
                            </form>
                          ) : (
                            <span />
                          )}
                          <Button type="submit" form="hunter-config-form">
                            {firstLiveConnection ? "Update key" : "Save Hunter settings"}
                          </Button>
                        </DialogFooter>
                      </>
                    ) : null}

                    {tile.provider === "calendly" && !firstLiveConnection ? (
                      <Button asChild className="w-fit">
                        <Link href="/api/integrations/calendly/connect">Connect Calendly</Link>
                      </Button>
                    ) : null}

                    {tile.provider === "calendly" && firstLiveConnection ? (
                      <>
                        <form
                          id="calendly-config-form"
                          action="/api/integrations/calendly/configure"
                          method="post"
                          className="grid gap-3"
                        >
                          <ConnectionMeta label="Webhook URL" value="/api/integrations/calendly/webhook" />
                          <TextField
                            label="Webhook signing key"
                            name="signingKey"
                            placeholder={
                              firstLiveConnection.secretHint
                                ? `Current key ends in ${firstLiveConnection.secretHint}`
                                : "Calendly signing key"
                            }
                            required
                          />
                          <div className="grid gap-2">
                            <p className="text-sm font-medium text-foreground">Webhook events</p>
                            <CheckboxList
                              name="eventTypes"
                              options={calendlyEventOptions}
                              selectedValues={calendlyEventDefaults}
                            />
                          </div>
                        </form>
                        <DialogFooter className="justify-between">
                          <form action="/api/integrations/disconnect" method="post">
                            <input type="hidden" name="integrationId" value={firstLiveConnection.id} />
                            <Button type="submit" variant="outline">
                              Disconnect
                            </Button>
                          </form>
                          <Button type="submit" form="calendly-config-form">
                            Save Calendly settings
                          </Button>
                        </DialogFooter>
                      </>
                    ) : null}
                  </div>
                )}

                {previousConnections.length ? (
                  <div className="grid gap-2 rounded-[1.1rem] border border-dashed border-white/70 bg-[rgba(244,247,250,0.82)] p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Previously connected</p>
                    <div className="grid gap-2">
                      {previousConnections.map((connection) => (
                        <div key={connection.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span>{connection.accountLabel}</span>
                          <span>{formatDateTime(connection.lastActivityAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </FormSection>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function IntegrationsHub({ canManage, data, initialProvider = null }: IntegrationsHubProps) {
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProviderKey | null>(initialProvider);
  const tiles = useMemo(() => data.categories.flatMap((category) => category.entries), [data.categories]);
  const selectedTile = tiles.find((tile) => tile.provider === selectedProvider) ?? null;
  const selectedConnections = useMemo(
    () =>
      selectedProvider
        ? [...data.connectedItems, ...data.previousItems].filter(
            (connection) => connection.provider === selectedProvider,
          )
        : [],
    [data.connectedItems, data.previousItems, selectedProvider],
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewCard
          label="Connected"
          value={String(data.overview.connectedCount)}
          description="Live integrations across CRM, alerts, meetings, and deliverability."
        />
        <OverviewCard
          label="Needs attention"
          value={String(data.overview.needsAttentionCount)}
          description="Connected providers that need configuration or have a recent error."
        />
        <OverviewCard
          label="Categories active"
          value={String(data.overview.categoriesActiveCount)}
          description="How many integration groups are actively in use in this workspace."
        />
        <OverviewCard
          label="Related mailbox setup"
          value={getMailboxSummaryLabel(data.mailboxSummary)}
          description="Mailbox approvals stay on the sending page so this hub stays focused."
        />
      </div>

      <SectionCard
        title="Connected integrations"
        description="Live connections stay in one consistent list so admins can spot health, recency, and the right next action without hunting through setup forms."
        aside={<Badge variant="neutral">{data.connectedItems.length} live</Badge>}
      >
        {data.connectedItems.length ? (
          <div className="grid gap-3">
            {data.connectedItems.map((item) => {
              const tile = tiles.find((entry) => entry.provider === item.provider);

              return (
                <div
                  key={item.id}
                  className="grid gap-4 rounded-[1.45rem] border border-white/72 bg-[rgba(255,255,255,0.78)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setSelectedProvider(item.provider)}
                      className="grid min-w-0 gap-2 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex size-10 items-center justify-center rounded-[1rem] border border-white/72 bg-[rgba(230,242,247,0.9)] text-accent-foreground">
                          {tile ? renderProviderIcon(tile, "size-4") : getProviderIcon("crm", "size-4")}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{item.title}</span>
                        <Badge variant="neutral">{item.categoryTitle}</Badge>
                        <Badge variant={getHealthBadgeVariant(item.health)}>{getHealthLabel(item.health)}</Badge>
                      </div>
                      <div className="grid gap-1">
                        <span className="text-base font-semibold tracking-[-0.03em] text-foreground">
                          {item.accountLabel}
                        </span>
                        {item.accountSubLabel ? (
                          <span className="text-sm text-muted-foreground">{item.accountSubLabel}</span>
                        ) : null}
                      </div>
                    </button>

                    <div className="flex flex-wrap gap-2">
                      {item.source === "crm" && item.provider !== "custom_crm" ? (
                        <>
                          <form action="/api/crm/sync" method="post">
                            <input type="hidden" name="connectionId" value={item.id} />
                            <Button type="submit" variant="secondary" size="sm" disabled={!canManage}>
                              <RefreshCcw className="size-4" />
                              Sync now
                            </Button>
                          </form>
                          <form action="/api/crm/disconnect" method="post">
                            <input type="hidden" name="connectionId" value={item.id} />
                            <Button type="submit" variant="outline" size="sm" disabled={!canManage}>
                              Disconnect
                            </Button>
                          </form>
                        </>
                      ) : null}

                      {item.provider === "custom_crm" || item.provider === "slack" || item.provider === "calendly" ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={!canManage}
                            onClick={() => setSelectedProvider(item.provider)}
                          >
                            Manage
                          </Button>
                          <form
                            action={item.source === "crm" ? "/api/crm/disconnect" : "/api/integrations/disconnect"}
                            method="post"
                          >
                            <input
                              type="hidden"
                              name={item.source === "crm" ? "connectionId" : "integrationId"}
                              value={item.id}
                            />
                            <Button type="submit" variant="outline" size="sm" disabled={!canManage}>
                              Disconnect
                            </Button>
                          </form>
                        </>
                      ) : null}

                      {item.provider === "webhook" ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={!canManage}
                            onClick={() => setSelectedProvider(item.provider)}
                          >
                            Manage
                          </Button>
                          <form action="/api/integrations/webhook/rotate-secret" method="post">
                            <Button type="submit" variant="outline" size="sm" disabled={!canManage}>
                              Rotate secret
                            </Button>
                          </form>
                        </>
                      ) : null}

                      {item.provider === "hunter" ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={!canManage}
                            onClick={() => setSelectedProvider(item.provider)}
                          >
                            Manage
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!canManage}
                            onClick={() => setSelectedProvider(item.provider)}
                          >
                            Update key
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <p className="text-sm leading-6 text-muted-foreground">{item.summary}</p>
                    <div className="rounded-full border border-white/68 bg-white/82 px-3 py-2 text-sm text-foreground">
                      {getActivityLabel(item.lastActivityKind)}: {formatDateTime(item.lastActivityAt)}
                    </div>
                  </div>

                  {item.lastError ? (
                    <div className="rounded-[1rem] border border-danger/25 bg-danger/10 px-3.5 py-3 text-sm text-danger">
                      {item.lastError}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-white/72 bg-[rgba(248,251,253,0.86)] px-5 py-8 text-center text-sm text-muted-foreground">
            No live integrations yet. Connect the systems that should improve campaign sync, alerts, and deliverability from the sections below.
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Explore integrations"
        description="Use the category groups below to evaluate what each connector enables before you connect it. All setup details stay in dialogs so the page remains compact."
      >
        <div className="grid gap-5">
          {data.categories.map((category) => (
            <div
              key={category.key}
              className="grid gap-4 rounded-[1.6rem] border border-white/72 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,248,252,0.82))] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">{category.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {category.key === "crm_sync"
                      ? "Lead sync and writeback providers."
                      : category.key === "automation_alerts"
                        ? "Alerts and downstream automation routes."
                        : category.key === "deliverability"
                          ? "Verification and send quality controls."
                          : category.key === "mailboxes"
                            ? "Mailbox providers that route into sender setup."
                          : "Meeting signals that improve workflow exits."}
                  </p>
                </div>
                <Badge variant="neutral">{category.entries.length} providers</Badge>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {category.entries.map((tile) => (
                  <button
                    key={tile.provider}
                    type="button"
                    onClick={() => setSelectedProvider(tile.provider)}
                    className="grid gap-4 rounded-[1.4rem] border border-white/70 bg-white/80 p-4 text-left transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex size-11 items-center justify-center rounded-[1.05rem] border border-white/72 bg-[rgba(230,242,247,0.9)] text-accent-foreground">
                          {renderProviderIcon(tile)}
                        </span>
                        <div className="grid gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold tracking-[-0.03em] text-foreground">
                              {tile.title}
                            </span>
                            <Badge variant={getBadgeVariantForTileStatus(tile.status)}>
                              {getTileStatusLabel(tile.status)}
                            </Badge>
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">{tile.shortValue}</p>
                        </div>
                      </div>
                      <ChevronRight className="mt-1 size-4 text-muted-foreground" />
                    </div>

                    <div className="grid gap-3 text-sm">
                      <div className="grid gap-1">
                        <p className="font-medium text-foreground">What it enables</p>
                        <p className="leading-6 text-muted-foreground">{tile.enables}</p>
                      </div>
                      <div className="grid gap-1">
                        <p className="font-medium text-foreground">Customer requirement</p>
                        <p className="leading-6 text-muted-foreground">{tile.customerRequirement}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">{tile.connectionSummary ?? "Ready to set up"}</p>
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-foreground">
                        {getTileCtaLabel(tile)}
                        <ExternalLink className="size-4" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Previously connected"
        description="Disconnected providers stay collapsed by default so there is historical context without adding clutter to active setup work."
        aside={<Badge variant="neutral">{data.previousItems.length} retained</Badge>}
      >
        <details className="group rounded-[1.35rem] border border-white/72 bg-[rgba(248,251,253,0.86)] px-4 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Retained connection history</p>
              <p className="text-sm text-muted-foreground">
                Review disconnected integrations without mixing them into the live workspace list.
              </p>
            </div>
            <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>

          <div className="mt-4 grid gap-3">
            {data.previousItems.length ? (
              data.previousItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[1.1rem] border border-white/72 bg-white/84 px-4 py-3"
                >
                  <div className="grid gap-1">
                    <p className="text-sm font-semibold text-foreground">
                      {item.title} · {item.accountLabel}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.categoryTitle} · {formatDateTime(item.lastActivityAt)}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedProvider(item.provider)}>
                    Open
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No previously connected integrations yet.</p>
            )}
          </div>
        </details>
      </SectionCard>

      <SectionCard
        title="Related setup"
        description="Mailbox setup stays separate on purpose. This page is for third-party systems and integration routing, while sending operations live under mailbox settings."
      >
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.4rem] border border-white/72 bg-[linear-gradient(135deg,rgba(230,242,247,0.62),rgba(255,255,255,0.92))] p-5">
          <div className="grid gap-1">
            <p className="text-base font-semibold tracking-[-0.03em] text-foreground">Mailbox setup lives on the sending page</p>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Connect and approve Gmail or Outlook senders there. This page shows mailbox discovery too, but operational sender setup still lives under sending.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/sending">
              Open sending setup
              <Link2 className="size-4" />
            </Link>
          </Button>
        </div>
      </SectionCard>

      <IntegrationDialog
        canManage={canManage}
        open={Boolean(selectedProvider)}
        onClose={() => setSelectedProvider(null)}
        tile={selectedTile}
        connectionItems={selectedConnections}
      />
    </div>
  );
}
