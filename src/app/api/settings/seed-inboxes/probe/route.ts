import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { queueSeedProbeJobs } from "@/services/seed-monitor-service";

export async function POST(request: Request) {
  const workspace = await getWorkspaceContext();

  if (!["owner", "admin"].includes(workspace.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can queue placement probes." }, { status: 403 });
  }

  await queueSeedProbeJobs(workspace.workspaceId);
  return NextResponse.redirect(new URL("/settings", request.url), { status: 303 });
}
