import { KpiCard } from "@/components/dashboard/kpi-card";
import { LazyReplyRateChart } from "@/components/dashboard/lazy-reply-rate-chart";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiquidSelect } from "@/components/ui/liquid-select";
import {
  getCachedDashboardMetrics,
  getCachedReplyRateByCampaign,
  getCachedWorkspaceProjectMetrics,
} from "@/lib/cache/read-models";
import { productContent } from "@/content/product";
import { getWorkspaceContext } from "@/lib/db/workspace";

type AnalyticsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const workspace = await getWorkspaceContext();
  const params = (await searchParams) ?? {};
  const requestedProjectId = typeof params.projectId === "string" ? params.projectId : null;
  const isAllProjects = requestedProjectId === "all";
  const selectedProject =
    workspace.availableProjects.find((project) => project.id === requestedProjectId) ??
    workspace.activeProject;
  const activeFilterProjectId = isAllProjects ? undefined : selectedProject.id;

  const [metrics, chartData, projectMetrics] = await Promise.all([
    getCachedDashboardMetrics(workspace.userId, workspace.workspaceId, activeFilterProjectId),
    getCachedReplyRateByCampaign(workspace.userId, workspace.workspaceId, activeFilterProjectId),
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
        title={productContent.analytics.title}
        description={productContent.analytics.description}
        actions={
          <form method="get" className="flex flex-wrap items-center gap-3">
            <LiquidSelect
              name="projectId"
              defaultValue={isAllProjects ? "all" : selectedProject.id}
              ariaLabel="Filter analytics by project"
              placeholder="Choose a project"
              triggerClassName="min-w-[14rem]"
              options={[
                { value: "all", label: productContent.analytics.allProjectsLabel, description: "Compare every project" },
                ...workspace.availableProjects.map((project) => ({
                  value: project.id,
                  label: project.name,
                  description: project.website || project.brand_name || "Project",
                })),
              ]}
            />
            <Button type="submit" size="sm">
              Apply filter
            </Button>
          </form>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={productContent.dashboard.kpis.totalLeads} value={metrics.totalLeads} />
        <KpiCard label={productContent.dashboard.kpis.sent} value={metrics.sent} />
        <KpiCard label={productContent.dashboard.kpis.followupSent} value={metrics.followupSent} />
        <KpiCard label={productContent.dashboard.kpis.replied} value={metrics.replied} />
        <KpiCard label={productContent.dashboard.kpis.unsubscribed} value={metrics.unsubscribed} />
        <KpiCard label={productContent.dashboard.kpis.failed} value={metrics.failed} />
        <KpiCard label={productContent.dashboard.kpis.queued} value={metrics.queued} />
        <KpiCard label={productContent.dashboard.kpis.replyRate} value={metrics.replyRate} kind="percent" />
      </section>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{productContent.analytics.campaignChartTitle}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isAllProjects
                ? "Showing every campaign across the workspace."
                : `Showing campaigns for ${selectedProject.name}.`}
            </p>
          </div>
          <Badge variant={isAllProjects ? "neutral" : "success"}>
            {isAllProjects ? productContent.analytics.allProjectsLabel : selectedProject.name}
          </Badge>
        </CardHeader>
        <CardContent>
          <LazyReplyRateChart data={chartData} title={productContent.analytics.campaignChartTitle} />
        </CardContent>
      </Card>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
              {productContent.analytics.projectBreakdownTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              Compare delivery volume and reply quality across every project in the workspace.
            </p>
          </div>
          <Badge variant="neutral">{workspace.availableProjects.length} projects</Badge>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {projectBreakdown.map(({ project, metrics: projectMetrics }) => (
            <Card key={project.id} id={`analytics-project-${project.id}`}>
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>{project.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {project.website || project.brand_name || "Project profile"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {project.id === workspace.activeProjectId ? <Badge variant="success">Active</Badge> : null}
                    <Badge variant="neutral">{projectMetrics.replyRate}% reply rate</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-3">
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
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Failures</p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                      {projectMetrics.failed}
                    </p>
                  </div>
                </div>
                <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                  {projectMetrics.totalLeads} leads in this project, {projectMetrics.queued} queued,{" "}
                  {projectMetrics.followupSent} follow-ups sent, and {projectMetrics.unsubscribed} unsubscribed.
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
