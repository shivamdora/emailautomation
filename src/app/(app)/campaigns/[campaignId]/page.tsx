import { PageHeader } from "@/components/layout/page-header";
import { DeleteCampaignButton } from "@/components/campaigns/delete-campaign-button";
import { SendNowButton } from "@/components/campaigns/send-now-button";
import { SimpleDataTable } from "@/components/data-table/simple-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { productContent } from "@/content/product";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { buildWorkflowDefinitionFromStoredSteps, normalizeWorkflowDefinition } from "@/lib/workflows/definition";
import { getCampaignById } from "@/services/campaign-service";
import Link from "next/link";

type CampaignContactRow = {
  id: string;
  status: string;
  current_step: number;
  next_due_at: string | null;
  contact?: {
    email?: string | null;
    company?: string | null;
  } | null;
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const workspace = await getWorkspaceContext();
  const campaign = (await getCampaignById(
    campaignId,
    workspace.workspaceId,
    workspace.activeProjectId,
  )) as {
    name: string;
    status: string;
    daily_send_limit: number;
    timezone: string;
    workflow_definition_jsonb?: Record<string, unknown> | null;
    send_window_start?: string | null;
    send_window_end?: string | null;
    campaign_steps?: Array<{
      id?: string;
      step_number: number;
      step_type?: string;
      subject_template: string;
      body_template: string;
      body_html_template?: string | null;
    }> | null;
    campaign_contacts?: CampaignContactRow[];
    contacts?: CampaignContactRow[];
  };
  const campaignContacts = (campaign.campaign_contacts ?? campaign.contacts ?? []) as CampaignContactRow[];
  const workflowDefinition = normalizeWorkflowDefinition(campaign.workflow_definition_jsonb);
  const fallbackWorkflow = buildWorkflowDefinitionFromStoredSteps(campaign.campaign_steps ?? []);
  const resolvedWorkflow = workflowDefinition.steps.length ? workflowDefinition : fallbackWorkflow;

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={productContent.campaigns.detail.eyebrow}
        title={campaign.name}
        description={productContent.campaigns.detail.description}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={`/campaigns/${campaignId}/edit`}>{productContent.campaigns.detail.editLabel}</Link>
            </Button>
            <DeleteCampaignButton campaignId={campaignId} />
            <SendNowButton campaignId={campaignId} />
            <form action="/api/campaigns/pause" method="post">
              <input type="hidden" name="campaignId" value={campaignId} />
              <input
                type="hidden"
                name="status"
                value={campaign.status === "active" ? "paused" : "active"}
              />
              <Button type="submit" variant="outline">
                {campaign.status === "active"
                  ? productContent.campaigns.detail.pauseLabel
                  : productContent.campaigns.detail.resumeLabel}
              </Button>
            </form>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle>{productContent.campaigns.detail.statusLabel}</CardTitle></CardHeader>
          <CardContent><Badge variant={campaign.status === "active" ? "success" : "neutral"}>{campaign.status}</Badge></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{productContent.campaigns.detail.dailyCapLabel}</CardTitle></CardHeader>
          <CardContent>{campaign.daily_send_limit}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{productContent.campaigns.detail.timezoneLabel}</CardTitle></CardHeader>
          <CardContent>{campaign.timezone}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{productContent.campaigns.detail.windowLabel}</CardTitle></CardHeader>
          <CardContent>{campaign.send_window_start ?? "09:00"} - {campaign.send_window_end ?? "17:00"}</CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {resolvedWorkflow.steps
          .map((step) => (
            <Card key={step.stepNumber}>
              <CardHeader>
                <CardTitle>
                  {productContent.campaigns.detail.stepTitle(
                    step.stepNumber,
                    step.name,
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{step.mode === "html" ? "HTML" : "Text"}</Badge>
                  <Badge variant="neutral">{`Wait ${step.waitDays}d`}</Badge>
                  <Badge variant="neutral">{`Branch ${step.branchCondition}`}</Badge>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{productContent.campaigns.detail.subjectLabel}</p>
                  <p className="font-medium">{step.subject}</p>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{productContent.campaigns.detail.bodyPreviewLabel}</p>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {step.mode === "html" ? productContent.campaigns.detail.htmlBodyPreviewLabel : step.body}
                  </p>
                </div>
                <div className="grid gap-1 text-sm text-muted-foreground">
                  <p>On match: {step.onMatch.replace(/_/g, " ")}</p>
                  <p>On no match: {step.onNoMatch.replace(/_/g, " ")}</p>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
      <SimpleDataTable
        title={productContent.campaigns.detail.contactsTitle}
        rows={campaignContacts.map((item) => ({
          id: item.id,
          status: item.status,
          current_step: item.current_step,
          next_due_at: item.next_due_at,
          email: item.contact?.email ?? "Unknown",
          company: item.contact?.company ?? "",
        }))}
        columns={[
          { key: "email", header: "Email" },
          { key: "company", header: "Company" },
          { key: "status", header: "Status", render: (row) => <Badge variant="neutral">{row.status}</Badge> },
          { key: "current_step", header: "Step" },
          { key: "next_due_at", header: "Next due" },
        ]}
      />
    </div>
  );
}
