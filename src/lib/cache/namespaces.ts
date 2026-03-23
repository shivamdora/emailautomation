import "server-only";
import { safeRedisIncrement, safeRedisDelete, safeRedisGet } from "@/lib/cache/redis";

function sanitizeSegment(value: string | number) {
  return String(value).replace(/[^a-zA-Z0-9:_-]+/g, "-");
}

function buildNamespaceId(parts: Array<string | number>) {
  return `ns:${parts.map(sanitizeSegment).join(":")}`;
}

export function getShellNamespaceId(userId: string) {
  return buildNamespaceId(["shell", "user", userId]);
}

export function getWorkspaceNamespaceId(userId: string, workspaceId: string) {
  return buildNamespaceId(["workspace", "user", userId, "workspace", workspaceId]);
}

export function getProjectNamespaceId(userId: string, workspaceId: string, projectId: string) {
  return buildNamespaceId(["project", "user", userId, "workspace", workspaceId, "project", projectId]);
}

export function getInboxNamespaceId(userId: string, workspaceId: string, projectId: string) {
  return buildNamespaceId(["inbox", "user", userId, "workspace", workspaceId, "project", projectId]);
}

async function readNamespaceVersion(namespaceId: string, label: string) {
  const raw = await safeRedisGet(namespaceId, label);

  if (raw == null) {
    return 0;
  }

  const parsed = typeof raw === "string" ? Number(raw) : Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getShellNamespaceVersion(userId: string) {
  return readNamespaceVersion(getShellNamespaceId(userId), "namespace-shell");
}

export async function getWorkspaceNamespaceVersion(userId: string, workspaceId: string) {
  return readNamespaceVersion(getWorkspaceNamespaceId(userId, workspaceId), "namespace-workspace");
}

export async function getProjectNamespaceVersion(userId: string, workspaceId: string, projectId: string) {
  return readNamespaceVersion(getProjectNamespaceId(userId, workspaceId, projectId), "namespace-project");
}

export async function getInboxNamespaceVersion(userId: string, workspaceId: string, projectId: string) {
  return readNamespaceVersion(getInboxNamespaceId(userId, workspaceId, projectId), "namespace-inbox");
}

export function buildVersionedCacheKey(namespaceVersion: number, parts: Array<string | number>) {
  return [...parts.map(sanitizeSegment), `v${namespaceVersion}`].join(":");
}

export async function invalidateShell(userId: string) {
  await safeRedisIncrement(getShellNamespaceId(userId), "invalidate-shell");
}

export async function invalidateWorkspace(userId: string, workspaceId: string) {
  await safeRedisIncrement(getWorkspaceNamespaceId(userId, workspaceId), "invalidate-workspace");
}

export async function invalidateProject(userId: string, workspaceId: string, projectId: string) {
  await safeRedisIncrement(getProjectNamespaceId(userId, workspaceId, projectId), "invalidate-project");
}

export async function invalidateInbox(
  userId: string,
  workspaceId: string,
  projectId: string,
  threadId?: string,
) {
  await safeRedisIncrement(getInboxNamespaceId(userId, workspaceId, projectId), "invalidate-inbox");

  if (threadId) {
    await safeRedisDelete(
      `inbox:detail:user:${sanitizeSegment(userId)}:thread:${sanitizeSegment(threadId)}`,
      "invalidate-inbox-detail",
    );
  }
}
