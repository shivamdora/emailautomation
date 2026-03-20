import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { signOAuthState } from "@/lib/auth/oauth-state";
import { getCRMAdapter, type CrmProvider } from "@/services/crm-adapters";

const SUPPORTED_PROVIDERS = new Set<CrmProvider>(["hubspot", "salesforce"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;

  if (!SUPPORTED_PROVIDERS.has(provider as CrmProvider)) {
    return NextResponse.json({ error: "Unsupported CRM provider." }, { status: 400 });
  }

  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can connect CRM providers." }, { status: 403 });
  }

  const adapter = getCRMAdapter(provider as CrmProvider);

  if (!adapter.getConnectUrl) {
    return NextResponse.json({ error: "This CRM provider does not support OAuth connect." }, { status: 400 });
  }

  const state = await signOAuthState({
    workspaceId: workspace.workspaceId,
    userId: workspace.userId,
    provider,
  });
  const redirectUri = new URL(`/api/crm/callback/${provider}`, request.url).toString();

  return NextResponse.redirect(adapter.getConnectUrl(state, redirectUri));
}
