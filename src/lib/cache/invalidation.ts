import "server-only";
import {
  invalidateInbox,
  invalidateProject,
  invalidateShell,
  invalidateWorkspace,
} from "@/lib/cache/namespaces";

type ProjectScope = {
  userId: string;
  workspaceId: string;
  projectId: string;
};

export async function invalidateProjectReadModels(
  scope: ProjectScope,
  options?: {
    includeShell?: boolean;
    includeWorkspace?: boolean;
    includeInbox?: boolean;
    threadId?: string;
  },
) {
  const tasks: Array<Promise<unknown>> = [
    invalidateProject(scope.userId, scope.workspaceId, scope.projectId),
  ];

  if (options?.includeShell) {
    tasks.push(invalidateShell(scope.userId));
  }

  if (options?.includeWorkspace) {
    tasks.push(invalidateWorkspace(scope.userId, scope.workspaceId));
  }

  if (options?.includeInbox) {
    tasks.push(
      invalidateInbox(
        scope.userId,
        scope.workspaceId,
        scope.projectId,
        options.threadId,
      ),
    );
  }

  await Promise.all(tasks);
}
