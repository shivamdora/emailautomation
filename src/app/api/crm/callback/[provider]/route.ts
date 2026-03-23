import { NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/auth/oauth-state";
import { getCRMAdapter, type CrmProvider } from "@/services/crm-adapters";
import { storeOAuthCrmConnection } from "@/services/crm-service";

const SUPPORTED_PROVIDERS = new Set<CrmProvider>(["hubspot", "salesforce", "pipedrive", "zoho"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;

  if (!SUPPORTED_PROVIDERS.has(provider as CrmProvider)) {
    return NextResponse.redirect(new URL("/settings/integrations?crm=unsupported-provider", request.url));
  }

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(new URL("/settings/integrations?crm=missing-code", request.url));
    }

    const payload = await verifyOAuthState<{
      workspaceId: string;
      userId: string;
      provider: CrmProvider;
    }>(state);
    const adapter = getCRMAdapter(provider as CrmProvider);

    if (!adapter.exchangeCode) {
      return NextResponse.redirect(new URL("/settings/integrations?crm=unsupported-provider", request.url));
    }

    const redirectUri = new URL(`/api/crm/callback/${provider}`, request.url).toString();
    const exchange = await adapter.exchangeCode(code, redirectUri);
    await storeOAuthCrmConnection({
      workspaceId: payload.workspaceId,
      actorUserId: payload.userId,
      provider: provider as Exclude<CrmProvider, "custom_crm">,
      exchange,
    });

    return NextResponse.redirect(new URL(`/settings/integrations?crm=${provider}-connected`, request.url));
  } catch (error) {
    console.error("CRM callback failed", error);
    const message = error instanceof Error ? error.message : "crm-connect-failed";
    return NextResponse.redirect(
      new URL(`/settings/integrations?crm=error&message=${encodeURIComponent(message.slice(0, 160))}`, request.url),
    );
  }
}
