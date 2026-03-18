import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { contactUpdateSchema } from "@/lib/zod/schemas";
import { deleteContact, updateContact } from "@/services/import-service";
import { logActivity } from "@/services/activity-log-service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ contactId: string }> },
) {
  const payload = contactUpdateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  try {
    const workspace = await getWorkspaceContext();
    const { contactId } = await context.params;
    const contact = await updateContact({
      workspaceId: workspace.workspaceId,
      contactId,
      email: payload.data.email,
      firstName: payload.data.firstName,
      lastName: payload.data.lastName,
      company: payload.data.company,
      website: payload.data.website,
      jobTitle: payload.data.jobTitle,
      tagNames: payload.data.tagNames ?? [],
    });

    await logActivity({
      workspaceId: workspace.workspaceId,
      actorUserId: workspace.userId,
      action: "contact.updated",
      targetType: "contact",
      targetId: contactId,
    });

    return NextResponse.json({ contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update contact";

    return NextResponse.json(
      { error: message },
      { status: /already uses that email/i.test(message) ? 409 : 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ contactId: string }> },
) {
  try {
    const workspace = await getWorkspaceContext();
    const { contactId } = await context.params;

    await deleteContact(workspace.workspaceId, contactId);
    await logActivity({
      workspaceId: workspace.workspaceId,
      actorUserId: workspace.userId,
      action: "contact.deleted",
      targetType: "contact",
      targetId: contactId,
    });

    return NextResponse.json({ ok: true, contactId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete contact";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
