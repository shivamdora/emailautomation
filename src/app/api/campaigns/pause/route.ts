import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { pauseCampaignSchema } from "@/lib/zod/schemas";
import { pauseCampaign } from "@/services/campaign-service";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const body =
    contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  const payload = pauseCampaignSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  const workspace = await getWorkspaceContext();
  const result = await pauseCampaign(
    payload.data.campaignId,
    workspace.workspaceId,
    workspace.activeProjectId,
    payload.data.status,
  );

  if (contentType.includes("application/json")) {
    return NextResponse.json(result);
  }

  return NextResponse.redirect(new URL(`/campaigns/${payload.data.campaignId}`, request.url));
}
