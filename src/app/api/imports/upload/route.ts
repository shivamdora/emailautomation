import { NextResponse } from "next/server";
import { invalidateProjectReadModels } from "@/lib/cache/invalidation";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireSupabaseConfiguration } from "@/lib/supabase/env";
import { processImportFile } from "@/services/import-service";
import { logActivity } from "@/services/activity-log-service";

function isClientImportRequest(request: Request) {
  return request.headers.get("x-import-client") === "1";
}

export async function POST(request: Request) {
  try {
    requireSupabaseConfiguration();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.redirect(new URL("/imports?error=missing-file", request.url));
    }

    const workspace = await getWorkspaceContext();
    const buffer = await file.arrayBuffer();
    const supabase = createAdminSupabaseClient();
    const storagePath = `${workspace.workspaceId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("imports").upload(storagePath, file, {
      upsert: false,
      contentType: file.type,
    });

    if (uploadError) {
      throw uploadError;
    }

    const lowerFileName = file.name.toLowerCase();
    const sourceType = lowerFileName.endsWith(".csv") ? "csv" : "xlsx";
    const result = await processImportFile({
      workspaceId: workspace.workspaceId,
      projectId: workspace.activeProjectId,
      userId: workspace.userId,
      fileName: file.name,
      fileBuffer: buffer,
      storagePath,
      sourceType,
    });

    await logActivity({
      workspaceId: workspace.workspaceId,
      actorUserId: workspace.userId,
      action: "import.processed",
      targetType: "import",
      targetId: result.importId,
      metadata: { importedCount: result.importedCount },
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
        status: "uploaded",
        count: result.importedCount,
      });
    }

    return NextResponse.redirect(new URL(`/imports?status=uploaded&count=${result.importedCount}`, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";

    if (isClientImportRequest(request)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.redirect(new URL(`/imports?error=${encodeURIComponent(message)}`, request.url));
  }
}
