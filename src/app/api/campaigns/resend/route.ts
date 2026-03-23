import { NextResponse } from "next/server";
import { invalidateProjectReadModels } from "@/lib/cache/invalidation";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { resendCampaignContactSchema } from "@/lib/zod/schemas";
import { markFailedContactForResend } from "@/services/campaign-service";

export async function POST(request: Request) {
  const payload = resendCampaignContactSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  const workspace = await getWorkspaceContext();
  const result = await markFailedContactForResend(payload.data.campaignContactId);
  await invalidateProjectReadModels(
    {
      userId: workspace.userId,
      workspaceId: workspace.workspaceId,
      projectId: workspace.activeProjectId,
    },
    { includeWorkspace: true },
  );
  return NextResponse.json(result);
}
