import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { campaignLaunchSchema } from "@/lib/zod/schemas";
import { createCampaign } from "@/services/campaign-service";
import { logActivity } from "@/services/activity-log-service";

export async function POST(request: Request) {
  const payload = campaignLaunchSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  const workspace = await getWorkspaceContext();
  const result = await createCampaign({
    workspaceId: workspace.workspaceId,
    projectId: workspace.activeProjectId,
    userId: workspace.userId,
    ...payload.data,
  });

  await logActivity({
    workspaceId: workspace.workspaceId,
    actorUserId: workspace.userId,
    action: "campaign.created",
    targetType: "campaign",
    targetId: result.id,
  });

  return NextResponse.json(result);
}
