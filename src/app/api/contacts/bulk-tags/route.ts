import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { bulkTagContactsSchema } from "@/lib/zod/schemas";
import { bulkTagContacts } from "@/services/import-service";
import { logActivity } from "@/services/activity-log-service";

export async function POST(request: Request) {
  const payload = bulkTagContactsSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  try {
    const workspace = await getWorkspaceContext();
    const result = await bulkTagContacts({
      workspaceId: workspace.workspaceId,
      contactIds: payload.data.contactIds,
      tagNames: payload.data.tagNames,
      operation: payload.data.operation,
    });

    await logActivity({
      workspaceId: workspace.workspaceId,
      actorUserId: workspace.userId,
      action: "contact.bulk_tags_updated",
      targetType: "contact",
      targetId: payload.data.contactIds.join(","),
      metadata: {
        operation: payload.data.operation,
        tagNames: result.tagNames,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update tags";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
