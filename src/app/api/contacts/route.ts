import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { manualContactSchema } from "@/lib/zod/schemas";
import { createManualContact } from "@/services/import-service";
import { logActivity } from "@/services/activity-log-service";

export async function POST(request: Request) {
  const payload = manualContactSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  try {
    const workspace = await getWorkspaceContext();
    const contact = await createManualContact({
      workspaceId: workspace.workspaceId,
      projectId: workspace.activeProjectId,
      userId: workspace.userId,
      email: payload.data.email,
      firstName: payload.data.firstName,
      lastName: payload.data.lastName,
      company: payload.data.company,
      website: payload.data.website,
      jobTitle: payload.data.jobTitle,
    });

    await logActivity({
      workspaceId: workspace.workspaceId,
      actorUserId: workspace.userId,
      action: "contact.created",
      targetType: "contact",
      targetId: contact.id,
    });

    return NextResponse.json({ contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create contact";

    return NextResponse.json(
      { error: message },
      { status: /already exists/i.test(message) ? 409 : 500 },
    );
  }
}
