import Link from "next/link";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { LazyReplyRateChart } from "@/components/dashboard/lazy-reply-rate-chart";
import { LiveRefresh } from "@/components/layout/live-refresh";
import { PageHeader } from "@/components/layout/page-header";
import { productContent } from "@/content/product";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCachedDashboardMetrics,
  getCachedReplyRateByCampaign,
  getCachedWorkspaceProjectMetrics,
} from "@/lib/cache/read-models";
import { getWorkspaceContext } from "@/lib/db/workspace";

export default async function DashboardPage() {
  const workspace = await getWorkspaceContext();
  const [metrics, chartData, projectMetrics] = await Promise.all([
    getCachedDashboardMetrics(workspace.userId, workspace.workspaceId),
    getCachedReplyRateByCampaign(workspace.userId, workspace.workspaceId),
    getCachedWorkspaceProjectMetrics(workspace.userId, workspace.workspaceId),
  ]);
  const projectMetricsById = new Map(projectMetrics.map((item) => [item.projectId, item]));
  const projectBreakdown = workspace.availableProjects.map((project) => ({
    project,
    metrics:
      projectMetricsById.get(project.id) ?? {
        totalLeads: 0,
        queued: 0,
        sent: 0,
        followupSent: 0,
        replied: 0,
        unsubscribed: 0,
        failed: 0,
        replyRate: 0,
      },
  }));

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={workspace.workspaceName}
        title={productContent.dashboard.title}
        description={productContent.dashboard.description}
        actions={
          <LiveRefresh
            label={productContent.dashboard.liveRefreshLabel}
            syncEndpoint="/api/replies/sync"
          />
        }
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={productContent.dashboard.kpis.totalLeads} value={metrics.totalLeads} />
        <KpiCard label={productContent.dashboard.kpis.queued} value={metrics.queued} />
        <KpiCard label={productContent.dashboard.kpis.sent} value={metrics.sent} />
        <KpiCard label={productContent.dashboard.kpis.followupSent} value={metrics.followupSent} />
        <KpiCard label={productContent.dashboard.kpis.replied} value={metrics.replied} />
        <KpiCard label={productContent.dashboard.kpis.unsubscribed} value={metrics.unsubscribed} />
        <KpiCard label={productContent.dashboard.kpis.failed} value={metrics.failed} />
        <KpiCard label={productContent.dashboard.kpis.replyRate} value={metrics.replyRate} kind="percent" />
      </section>
      <LazyReplyRateChart data={chartData} title={productContent.dashboard.chartTitle} />
      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">Project breakdown</h2>
            <p className="text-sm text-muted-foreground">
              Compare active pipeline and reply performance across every project in this workspace.
            </p>
          </div>
          <Badge variant="neutral">{workspace.availableProjects.length} projects</Badge>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {projectBreakdown.map(({ project, metrics: projectMetrics }) => (
            <Card key={project.id}>
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>{project.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {project.website || project.brand_name || "Project profile"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {project.id === workspace.activeProjectId ? <Badge variant="success">Active project</Badge> : null}
                    <Badge variant="neutral">{projectMetrics.replyRate}% reply rate</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-[1.2rem] border border-white/60 bg-white/62 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Leads</p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                      {projectMetrics.totalLeads}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/60 bg-white/62 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Sent</p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                      {projectMetrics.sent}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/60 bg-white/62 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Replies</p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                      {projectMetrics.replied}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/60 bg-white/62 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Queued</p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                      {projectMetrics.queued}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild size="sm">
                    <Link href={`/analytics?projectId=${project.id}`}>Open analytics</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/settings/projects#project-${project.id}`}>Manage project</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>{productContent.dashboard.checklistTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          {productContent.dashboard.checklist.map((item, index) => (
            <div key={item}>
              {index + 1}. {item}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
