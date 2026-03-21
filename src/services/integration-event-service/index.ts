import "server-only";
import { createHmac } from "crypto";
import {
  getWorkspaceIntegrationDispatchTargets,
  markWorkspaceIntegrationError,
  markWorkspaceIntegrationEvent,
} from "@/services/workspace-integration-service";

export type WorkspaceIntegrationEventType =
  | "campaign.sent"
  | "campaign.replied"
  | "campaign.negative_reply"
  | "campaign.meeting_booked"
  | "campaign.unsubscribed"
  | "mailbox.approved"
  | "crm.sync_failed";

function buildSlackText(input: {
  eventType: WorkspaceIntegrationEventType;
  summary: string;
  metadata?: Record<string, unknown> | null;
}) {
  const lines = [input.summary];
  const metadataEntries = Object.entries(input.metadata ?? {})
    .filter(([, value]) => value !== null && typeof value !== "undefined" && value !== "")
    .slice(0, 5);

  for (const [key, value] of metadataEntries) {
    lines.push(`${key}: ${String(value)}`);
  }

  return lines.join("\n");
}

function isEventEnabled(
  configuredEvents: unknown,
  eventType: WorkspaceIntegrationEventType,
) {
  if (!Array.isArray(configuredEvents) || !configuredEvents.length) {
    return true;
  }

  return configuredEvents.includes(eventType);
}

async function sendSlackNotification(input: {
  accessToken: string;
  channelId: string;
  eventType: WorkspaceIntegrationEventType;
  summary: string;
  metadata?: Record<string, unknown> | null;
}) {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: input.channelId,
      text: buildSlackText({
        eventType: input.eventType,
        summary: input.summary,
        metadata: input.metadata ?? {},
      }),
    }),
  });

  const payload = (await response.json()) as { ok?: boolean; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Slack notification failed.");
  }
}

async function sendWebhookNotification(input: {
  webhookUrl: string;
  eventType: WorkspaceIntegrationEventType;
  summary: string;
  metadata?: Record<string, unknown> | null;
  signingSecret?: string | null;
}) {
  const body = JSON.stringify({
    type: input.eventType,
    summary: input.summary,
    metadata: input.metadata ?? {},
    occurredAt: new Date().toISOString(),
  });
  const signature = input.signingSecret
    ? createHmac("sha256", input.signingSecret).update(body).digest("hex")
    : null;
  const response = await fetch(input.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "x-outboundflow-signature": signature } : {}),
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed: ${await response.text()}`);
  }
}

export async function emitWorkspaceIntegrationEvent(input: {
  workspaceId: string;
  eventType: WorkspaceIntegrationEventType;
  summary: string;
  metadata?: Record<string, unknown> | null;
}) {
  const targets = await getWorkspaceIntegrationDispatchTargets(input.workspaceId);

  for (const target of targets) {
    if (target.provider === "slack") {
      const channelId = String(target.config_jsonb?.channelId ?? "").trim();

      if (!target.accessToken || !channelId) {
        continue;
      }

      if (!isEventEnabled(target.config_jsonb?.eventTypes, input.eventType)) {
        continue;
      }

      try {
        await sendSlackNotification({
          accessToken: target.accessToken,
          channelId,
          eventType: input.eventType,
          summary: input.summary,
          metadata: input.metadata ?? {},
        });
        await markWorkspaceIntegrationEvent({
          workspaceId: input.workspaceId,
          provider: "slack",
          kind: "event",
        });
      } catch (error) {
        await markWorkspaceIntegrationError({
          workspaceId: input.workspaceId,
          provider: "slack",
          error: error instanceof Error ? error.message : "Slack delivery failed.",
        });
      }
    }

    if (target.provider === "webhook") {
      const webhookUrl = String(target.config_jsonb?.webhookUrl ?? "").trim();

      if (!webhookUrl) {
        continue;
      }

      if (!isEventEnabled(target.config_jsonb?.eventTypes, input.eventType)) {
        continue;
      }

      try {
        await sendWebhookNotification({
          webhookUrl,
          eventType: input.eventType,
          summary: input.summary,
          metadata: input.metadata ?? {},
          signingSecret: target.signingSecret,
        });
        await markWorkspaceIntegrationEvent({
          workspaceId: input.workspaceId,
          provider: "webhook",
          kind: "event",
        });
      } catch (error) {
        await markWorkspaceIntegrationError({
          workspaceId: input.workspaceId,
          provider: "webhook",
          error: error instanceof Error ? error.message : "Webhook delivery failed.",
        });
      }
    }
  }
}
