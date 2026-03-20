import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { bulkDeleteContactsSchema } from "@/lib/zod/schemas";
import { bulkDeleteContacts } from "@/services/import-service";
import { logActivity } from "@/services/activity-log-service";

export async function POST(request: Request) {
  const payload = bulkDeleteContactsSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  try {
    const workspace = await getWorkspaceContext();
    const result = await bulkDeleteContacts(
      workspace.workspaceId,
      workspace.activeProjectId,
      payload.data.contactIds,
    );

    await logActivity({
      workspaceId: workspace.workspaceId,
      actorUserId: workspace.userId,
      action: "contact.bulk_deleted",
      targetType: "contact",
      targetId: payload.data.contactIds.join(","),
      metadata: { deletedCount: result.deletedCount },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete contacts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
