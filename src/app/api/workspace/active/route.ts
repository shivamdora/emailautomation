import { NextResponse } from "next/server";
import { invalidateShell, invalidateWorkspace } from "@/lib/cache/namespaces";
import { getSessionUser } from "@/lib/auth/session";
import { bootstrapWorkspaceForUser, getWorkspaceContext, setActiveWorkspace } from "@/lib/db/workspace";

function redirectTo(url: URL, searchParams: Record<string, string>) {
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "No authenticated session found." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const isJsonRequest = contentType.includes("application/json");
  const body =
    isJsonRequest
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  const workspaceId = String(body.workspaceId ?? "");

  if (!workspaceId) {
    if (isJsonRequest) {
      return NextResponse.json({ error: "Workspace ID is required." }, { status: 400 });
    }

    return redirectTo(new URL("/settings/advanced", request.url), {
      status: "error",
      workspaceMessage: "Workspace ID is required.",
    });
  }

  try {
    const previousWorkspace = await getWorkspaceContext().catch(() => null);
    const result = await setActiveWorkspace(user.id, workspaceId);
    await bootstrapWorkspaceForUser({
      id: user.id,
      email: user.email ?? null,
      user_metadata: (user.user_metadata as { full_name?: string | null } | null) ?? null,
    });
    await Promise.all([
      invalidateShell(user.id),
      invalidateWorkspace(user.id, workspaceId),
      previousWorkspace?.workspaceId
        ? invalidateWorkspace(user.id, previousWorkspace.workspaceId)
        : Promise.resolve(),
    ]);

    if (isJsonRequest) {
      return NextResponse.json(result);
    }

    return redirectTo(new URL("/settings/advanced", request.url), {
      status: "workspace-switched",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to switch workspace.";

    if (isJsonRequest) {
      return NextResponse.json({ error: message }, { status: /denied/i.test(message) ? 403 : 500 });
    }

    return redirectTo(new URL("/settings/advanced", request.url), {
      status: "error",
      workspaceMessage: message,
    });
  }
}
