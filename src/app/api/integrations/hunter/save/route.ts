import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { saveHunterWorkspaceIntegration } from "@/services/workspace-integration-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can manage Hunter." }, { status: 403 });
  }

  const formData = await request.formData();
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const verifyOnImport = String(formData.get("verifyOnImport") ?? "") === "true";
  const preLaunchRule =
    String(formData.get("preLaunchRule") ?? "") === "block_invalid" ? "block_invalid" : "warn_only";

  if (!apiKey) {
    return NextResponse.json({ error: "Hunter API key is required." }, { status: 400 });
  }

  await saveHunterWorkspaceIntegration({
    workspaceId: workspace.workspaceId,
    apiKey,
    verifyOnImport,
    preLaunchRule,
  });

  return NextResponse.redirect(new URL("/settings/integrations", request.url), { status: 303 });
}
