import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { decryptToken } from "@/lib/crypto/tokens";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { markMeetingBookedFromEmail } from "@/services/meeting-service";
import { markWorkspaceIntegrationEvent } from "@/services/workspace-integration-service";

function parseCalendlySignature(value: string | null) {
  const parts = String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const timestamp = parts.find((entry) => entry.startsWith("t="))?.slice(2) ?? "";
  const signature = parts.find((entry) => entry.startsWith("v1="))?.slice(3) ?? "";

  return { timestamp, signature };
}

function signaturesMatch(input: { body: string; timestamp: string; signature: string; signingKey: string }) {
  const expected = createHmac("sha256", input.signingKey)
    .update(`${input.timestamp}.${input.body}`)
    .digest("hex");

  if (expected.length !== input.signature.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature));
}

function extractInviteeEmail(payload: Record<string, unknown>) {
  const questionsAndAnswers = Array.isArray(payload.questions_and_answers)
    ? payload.questions_and_answers
    : [];
  const candidateFromAnswers = questionsAndAnswers.find((entry) => {
    const answer = entry as { position?: number; answer?: string | null } | null;
    return answer?.position === 0 && typeof answer.answer === "string";
  }) as { answer?: string | null } | undefined;
  const candidate =
    payload.email ??
    (payload.invitee as { email?: string | null } | null | undefined)?.email ??
    (payload.email_address as string | null | undefined) ??
    candidateFromAnswers?.answer ??
    null;

  return typeof candidate === "string" ? candidate.trim().toLowerCase() : "";
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const { timestamp, signature } = parseCalendlySignature(
    request.headers.get("Calendly-Webhook-Signature"),
  );

  if (!timestamp || !signature) {
    return NextResponse.json({ error: "Missing Calendly signature." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("workspace_integrations")
    .select("workspace_id, signing_secret_encrypted")
    .eq("provider", "calendly")
    .in("status", ["connected", "error"]);

  if (error) {
    throw error;
  }

  const matched = ((data ?? []) as Array<{
    workspace_id: string;
    signing_secret_encrypted?: string | null;
  }>).find((integration) => {
    if (!integration.signing_secret_encrypted) {
      return false;
    }

    try {
      return signaturesMatch({
        body: rawBody,
        timestamp,
        signature,
        signingKey: decryptToken(integration.signing_secret_encrypted),
      });
    } catch {
      return false;
    }
  });

  if (!matched) {
    return NextResponse.json({ error: "Invalid Calendly signature." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    event?: string;
    payload?: Record<string, unknown> | null;
  };
  const eventType = String(payload.event ?? "").trim();

  if (eventType === "invitee.created") {
    const inviteeEmail = extractInviteeEmail(payload.payload ?? {});

    if (inviteeEmail) {
      await markMeetingBookedFromEmail({
        workspaceId: matched.workspace_id,
        email: inviteeEmail,
        metadata: {
          calendlyEventType: eventType,
        },
      });
    }
  }

  await markWorkspaceIntegrationEvent({
    workspaceId: matched.workspace_id,
    provider: "calendly",
    kind: "event",
  });

  return NextResponse.json({ ok: true });
}
