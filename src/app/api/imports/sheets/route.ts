import { NextResponse } from "next/server";
import { invalidateProjectReadModels } from "@/lib/cache/invalidation";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { googleSheetsImportSchema } from "@/lib/zod/schemas";
import { importFromGoogleSheet } from "@/services/import-service";
import { logActivity } from "@/services/activity-log-service";

function isClientImportRequest(request: Request) {
  return request.headers.get("x-import-client") === "1";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const payload = googleSheetsImportSchema.safeParse({
      url: formData.get("url"),
    });

    if (!payload.success) {
      if (isClientImportRequest(request)) {
        return NextResponse.json({ error: "Invalid Google Sheets URL." }, { status: 400 });
      }

      return NextResponse.redirect(new URL("/imports?error=invalid-sheet-url", request.url));
    }

    const workspace = await getWorkspaceContext();
    const result = await importFromGoogleSheet({
      workspaceId: workspace.workspaceId,
      projectId: workspace.activeProjectId,
      userId: workspace.userId,
      url: payload.data.url,
    });

    await logActivity({
      workspaceId: workspace.workspaceId,
      actorUserId: workspace.userId,
      action: "import.google_sheet",
      targetType: "import",
      targetId: result.importId,
    });
    await invalidateProjectReadModels(
      {
        userId: workspace.userId,
        workspaceId: workspace.workspaceId,
        projectId: workspace.activeProjectId,
      },
      { includeWorkspace: true },
    );

    if (isClientImportRequest(request)) {
      return NextResponse.json({
        ok: true,
        status: "sheets-imported",
        count: result.importedCount,
      });
    }

    return NextResponse.redirect(new URL(`/imports?status=sheets-imported&count=${result.importedCount}`, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Sheets import failed.";

    if (isClientImportRequest(request)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.redirect(new URL(`/imports?error=${encodeURIComponent(message)}`, request.url));
  }
}
