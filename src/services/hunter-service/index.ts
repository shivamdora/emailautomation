import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getWorkspaceHunterConfiguration } from "@/services/workspace-integration-service";

type HunterVerificationEnvelope = {
  result: string;
  score?: number | null;
  status: "safe" | "risky" | "invalid";
  checkedAt: string;
  source: "hunter";
};

function toStoredVerification(input: {
  result: string;
  score?: number | null;
}): HunterVerificationEnvelope {
  const normalized = input.result.trim().toLowerCase();
  const invalid = new Set(["invalid", "disposable", "accept_all", "unknown"]);
  const risky = new Set(["webmail", "risky"]);

  return {
    result: normalized || "unknown",
    score: input.score ?? null,
    status: invalid.has(normalized) ? "invalid" : risky.has(normalized) ? "risky" : "safe",
    checkedAt: new Date().toISOString(),
    source: "hunter",
  };
}

async function verifyEmailWithHunter(apiKey: string, email: string) {
  const url = new URL("https://api.hunter.io/v2/email-verifier");
  url.searchParams.set("email", email);
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url);
  const payload = (await response.json()) as {
    data?: {
      status?: string | null;
      score?: number | null;
      result?: string | null;
    } | null;
    errors?: Array<{ details?: string | null }> | null;
  };

  if (!response.ok) {
    throw new Error(payload.errors?.[0]?.details || "Hunter verification failed.");
  }

  return toStoredVerification({
    result: payload.data?.result ?? payload.data?.status ?? "unknown",
    score: payload.data?.score ?? null,
  });
}

export async function maybeVerifyImportedContactsWithHunter<
  T extends {
    email: string;
    custom_fields_jsonb: Record<string, string | null>;
  },
>(input: {
  workspaceId: string;
  contacts: T[];
}) {
  const config = await getWorkspaceHunterConfiguration(input.workspaceId);

  if (!config?.verifyOnImport || !input.contacts.length) {
    return input.contacts;
  }

  const nextContacts = [...input.contacts];

  for (let index = 0; index < nextContacts.length; index += 5) {
    const batch = nextContacts.slice(index, index + 5);
    const results = await Promise.allSettled(
      batch.map((contact) => verifyEmailWithHunter(config.apiKey, contact.email)),
    );

    results.forEach((result, offset) => {
      const contact = nextContacts[index + offset];

      if (!contact) {
        return;
      }

      if (result.status === "fulfilled") {
        contact.custom_fields_jsonb = {
          ...contact.custom_fields_jsonb,
          delivery_verification: JSON.stringify(result.value),
        };
        return;
      }

      contact.custom_fields_jsonb = {
        ...contact.custom_fields_jsonb,
        delivery_verification_error: result.reason instanceof Error
          ? result.reason.message
          : "Hunter verification failed.",
      };
    });
  }

  return nextContacts;
}

export async function assertHunterPreLaunchGuardrails(input: {
  workspaceId: string;
  targetContactIds: string[];
}) {
  const config = await getWorkspaceHunterConfiguration(input.workspaceId);

  if (!config || config.preLaunchRule !== "block_invalid" || !input.targetContactIds.length) {
    return;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("email, custom_fields_jsonb")
    .eq("workspace_id", input.workspaceId)
    .in("id", input.targetContactIds);

  if (error) {
    throw error;
  }

  const blockedEmails = ((data ?? []) as Array<{
    email: string;
    custom_fields_jsonb?: Record<string, unknown> | null;
  }>)
    .map((contact) => {
      const rawVerification = contact.custom_fields_jsonb?.delivery_verification;

      if (typeof rawVerification !== "string") {
        return null;
      }

      try {
        const verification = JSON.parse(rawVerification) as HunterVerificationEnvelope;
        return verification.status === "invalid" ? contact.email : null;
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value));

  if (blockedEmails.length) {
    throw new Error(
      `Hunter blocked launch because these contacts are invalid: ${blockedEmails.slice(0, 8).join(", ")}`,
    );
  }
}
