import { NextResponse } from "next/server";
import { invalidateProjectReadModels } from "@/lib/cache/invalidation";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { templateSchema } from "@/lib/zod/schemas";
import { saveTemplate } from "@/services/campaign-service";
import { logActivity } from "@/services/activity-log-service";

export async function POST(request: Request) {
  const payload = templateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  const workspace = await getWorkspaceContext();
  const template = (await saveTemplate({
    workspaceId: workspace.workspaceId,
    projectId: workspace.activeProjectId,
    userId: workspace.userId,
    ...payload.data,
  })) as { id: string };

  await logActivity({
    workspaceId: workspace.workspaceId,
    actorUserId: workspace.userId,
    action: "template.created",
    targetType: "template",
    targetId: template.id,
  });
  await invalidateProjectReadModels({
    userId: workspace.userId,
    workspaceId: workspace.workspaceId,
    projectId: workspace.activeProjectId,
  });

  return NextResponse.json(template);
}
