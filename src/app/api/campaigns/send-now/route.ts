import { NextResponse } from "next/server";
import { invalidateProjectReadModels } from "@/lib/cache/invalidation";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { sendNowCampaignSchema } from "@/lib/zod/schemas";
import { sendCampaignNow } from "@/services/campaign-service";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const body =
      contentType.includes("application/json")
        ? await request.json()
        : Object.fromEntries((await request.formData()).entries());
    const payload = sendNowCampaignSchema.safeParse(body);

    if (!payload.success) {
      return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
    }

    const workspace = await getWorkspaceContext();
    const result = await sendCampaignNow(
      payload.data.campaignId,
      workspace.workspaceId,
      workspace.activeProjectId,
    );
    await invalidateProjectReadModels(
      {
        userId: workspace.userId,
        workspaceId: workspace.workspaceId,
        projectId: workspace.activeProjectId,
      },
      { includeWorkspace: true },
    );

    if (contentType.includes("application/json")) {
      return NextResponse.json(result);
    }

    return NextResponse.redirect(new URL(`/campaigns/${payload.data.campaignId}`, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
