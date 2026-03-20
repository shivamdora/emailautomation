import { LiveRefresh } from "@/components/layout/live-refresh";
import { PageHeader } from "@/components/layout/page-header";
import { ThreadViewer } from "@/components/threads/thread-viewer";
import { productContent } from "@/content/product";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { listThreads } from "@/services/analytics-service";

export default async function InboxPage() {
  const workspace = await getWorkspaceContext();
  const threads = (await listThreads(workspace.workspaceId, {
    projectId: workspace.activeProjectId,
  })) as Array<{
    id: string;
    subject: string | null;
    snippet: string | null;
    latest_message_at: string | null;
    campaign_contact_id?: string | null;
    campaign_status?: string | null;
    reply_disposition?: string | null;
    messages: Array<{
      id: string;
      direction: string;
      from_email: string | null;
      to_emails?: string[] | null;
      subject: string | null;
      body_text: string | null;
      body_html?: string | null;
      sent_at: string;
    }>;
  }>;

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
      <ThreadViewer threads={threads} />
    </div>
  );
}
