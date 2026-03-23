import { NextResponse } from "next/server";
import { invalidateProjectReadModels } from "@/lib/cache/invalidation";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { campaignLaunchSchema } from "@/lib/zod/schemas";
import { deleteCampaign, updateCampaign } from "@/services/campaign-service";
import { logActivity } from "@/services/activity-log-service";

export async function PUT(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
) {
  const payload = campaignLaunchSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  try {
    const workspace = await getWorkspaceContext();
    const { campaignId } = await context.params;
    const result = await updateCampaign({
      workspaceId: workspace.workspaceId,
      projectId: workspace.activeProjectId,
      campaignId,
      campaignName: payload.data.campaignName,
      mailboxAccountId: payload.data.mailboxAccountId,
      targetContactIds: payload.data.targetContactIds,
      timezone: payload.data.timezone,
      sendWindowStart: payload.data.sendWindowStart,
      sendWindowEnd: payload.data.sendWindowEnd,
      dailySendLimit: payload.data.dailySendLimit,
      workflowDefinition: payload.data.workflowDefinition,
    });

    await logActivity({
      workspaceId: workspace.workspaceId,
      actorUserId: workspace.userId,
      action: "campaign.updated",
      targetType: "campaign",
      targetId: campaignId,
    });
    await invalidateProjectReadModels(
      {
        userId: workspace.userId,
        workspaceId: workspace.workspaceId,
        projectId: workspace.activeProjectId,
      },
      { includeWorkspace: true },
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update campaign";
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ campaignId: string }> },
) {
  try {
    const workspace = await getWorkspaceContext();
    const { campaignId } = await context.params;
    const result = await deleteCampaign(campaignId, workspace.workspaceId, workspace.activeProjectId);

    await logActivity({
      workspaceId: workspace.workspaceId,
      actorUserId: workspace.userId,
      action: "campaign.deleted",
      targetType: "campaign",
      targetId: campaignId,
    });
    await invalidateProjectReadModels(
      {
        userId: workspace.userId,
        workspaceId: workspace.workspaceId,
        projectId: workspace.activeProjectId,
      },
      { includeWorkspace: true },
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
