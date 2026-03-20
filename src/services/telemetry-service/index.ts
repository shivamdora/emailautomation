import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { Buffer } from "buffer";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env, requireSupabaseConfiguration } from "@/lib/supabase/env";
import { normalizeEmailHtmlDocument } from "@/lib/utils/html";
import { enqueueCrmWritebackFromEvent } from "@/services/crm-service";

type TrackingPayload = {
  workspaceId: string;
  campaignContactId: string;
  stepNumber: number;
  targetUrl?: string | null;
  eventType: "opened" | "clicked";
};

function getTrackingSecret() {
  if (!env.TOKEN_ENCRYPTION_KEY) {
    throw new Error("Missing TOKEN_ENCRYPTION_KEY");
  }

  return new TextEncoder().encode(env.TOKEN_ENCRYPTION_KEY);
}

function getAppUrl() {
  return env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function signTrackingPayload(payload: TrackingPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(getTrackingSecret());
}

export async function verifyTrackingPayload(token: string) {
  const verified = await jwtVerify(token, getTrackingSecret());
  return verified.payload as unknown as TrackingPayload;
}

export async function recordMessageEvent(input: {
  workspaceId: string;
  campaignContactId?: string | null;
  outboundMessageId?: string | null;
  gmailMessageId?: string | null;
  eventType: "sent" | "opened" | "clicked" | "replied" | "unsubscribed" | "bounced" | "meeting_booked";
  metadata?: Record<string, unknown> | null;
}) {
  requireSupabaseConfiguration();

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("message_events").insert({
    workspace_id: input.workspaceId,
    campaign_contact_id: input.campaignContactId ?? null,
    outbound_message_id: input.outboundMessageId ?? null,
    gmail_message_id: input.gmailMessageId ?? null,
    event_type: input.eventType,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw error;
  }

  try {
    await enqueueCrmWritebackFromEvent({
      workspaceId: input.workspaceId,
      campaignContactId: input.campaignContactId ?? null,
      eventType: input.eventType,
      metadata: input.metadata ?? {},
    });
  } catch (writebackError) {
    console.error("Failed to enqueue CRM writeback", writebackError);
  }
}

function shouldTrackHref(href: string) {
  return /^https?:\/\//i.test(href.trim());
}

export async function instrumentHtmlForTracking(input: {
  workspaceId: string;
  campaignContactId: string;
  stepNumber: number;
  html: string;
}) {
  const normalizedHtml = normalizeEmailHtmlDocument(input.html);
  const appUrl = getAppUrl();
  const openToken = await signTrackingPayload({
    workspaceId: input.workspaceId,
    campaignContactId: input.campaignContactId,
    stepNumber: input.stepNumber,
    eventType: "opened",
  });
  const openPixel = `<img src="${appUrl}/api/track/open?token=${encodeURIComponent(openToken)}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;opacity:0;" />`;

  const rewritten = await Promise.all(
    Array.from(normalizedHtml.matchAll(/href=(["'])(.*?)\1/gi)).map(async ([match, quote, href]) => {
      if (!shouldTrackHref(href)) {
        return { match, replacement: match };
      }

      const clickToken = await signTrackingPayload({
        workspaceId: input.workspaceId,
        campaignContactId: input.campaignContactId,
        stepNumber: input.stepNumber,
        eventType: "clicked",
        targetUrl: href,
      });

      return {
        match,
        replacement: `href=${quote}${appUrl}/api/track/click?token=${encodeURIComponent(clickToken)}${quote}`,
      };
    }),
  );

  let trackedHtml = normalizedHtml;

  for (const item of rewritten) {
    trackedHtml = trackedHtml.replace(item.match, item.replacement);
  }

  if (/<\/body>/i.test(trackedHtml)) {
    return trackedHtml.replace(/<\/body>/i, `${openPixel}</body>`);
  }

  return `${trackedHtml}${openPixel}`;
}

export function buildTrackingPixelResponse() {
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    "base64",
  );

  return new Response(pixel, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, max-age=0",
      "Content-Length": String(pixel.byteLength),
    },
  });
}
