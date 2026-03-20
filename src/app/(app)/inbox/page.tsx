import { LiveRefresh } from "@/components/layout/live-refresh";
import { PageHeader } from "@/components/layout/page-header";
import { ThreadViewer } from "@/components/threads/thread-viewer";
import { productContent } from "@/content/product";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { getInboxThreadDetail, listInboxThreadSummaries } from "@/services/analytics-service";

export default async function InboxPage() {
  const workspace = await getWorkspaceContext();
  const initialThreadBatch = await listInboxThreadSummaries(workspace.workspaceId, {
    projectId: workspace.activeProjectId,
    limit: 10,
    offset: 0,
  });
  const initialSelectedThread =
    initialThreadBatch.threads[0]
      ? await getInboxThreadDetail(workspace.workspaceId, initialThreadBatch.threads[0].id, {
          projectId: workspace.activeProjectId,
        })
      : null;

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={productContent.inbox.header.eyebrow}
        title={productContent.inbox.header.title}
        description={productContent.inbox.header.description}
        actions={
          <LiveRefresh
            label={productContent.inbox.header.liveRefreshLabel}
            syncEndpoint="/api/replies/sync"
          />
        }
      />
      <ThreadViewer
        initialHasMore={initialThreadBatch.hasMore}
        initialSelectedThread={initialSelectedThread}
        initialThreads={initialThreadBatch.threads}
      />
    </div>
  );
}
