import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { PageHeader } from "@/components/layout/page-header";
import { productContent } from "@/content/product";
import { getCachedContacts, getCachedTemplates } from "@/lib/cache/read-models";
import { getWorkspaceContext } from "@/lib/db/workspace";
import type { TemplateListItem } from "@/lib/templates/gallery";
import { buildWorkflowDefinitionFromStoredSteps, normalizeWorkflowDefinition } from "@/lib/workflows/definition";
import { getCampaignForEditing } from "@/services/campaign-service";
import { getWorkspaceGmailAccounts } from "@/services/gmail-service";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const workspace = await getWorkspaceContext();
  const [campaign, rawGmailAccounts, contacts, rawTemplates] = await Promise.all([
    getCampaignForEditing(campaignId, workspace.workspaceId, workspace.activeProjectId),
    getWorkspaceGmailAccounts(workspace.workspaceId, {
      onlyApproved: true,
      projectId: workspace.activeProjectId,
    }),
    getCachedContacts(workspace.userId, workspace.workspaceId, workspace.activeProjectId),
    getCachedTemplates(workspace.userId, workspace.workspaceId, workspace.activeProjectId),
  ]);
  const gmailAccounts = rawGmailAccounts as Array<{ id: string; email_address: string }>;
  const templates = rawTemplates as TemplateListItem[];
  const workflowDefinition = normalizeWorkflowDefinition(campaign.workflow_definition_jsonb);
  const fallbackWorkflow = buildWorkflowDefinitionFromStoredSteps(campaign.campaign_steps ?? []);
  const resolvedWorkflow = workflowDefinition.steps.length ? workflowDefinition : fallbackWorkflow;

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={productContent.campaigns.editCampaign.eyebrow}
        title={productContent.campaigns.editCampaign.title(campaign.name)}
        description={productContent.campaigns.editCampaign.description}
      />
      <CampaignWizard
        mode="edit"
        campaignId={campaignId}
        gmailAccounts={gmailAccounts}
        contacts={contacts}
        templates={templates}
        initialValues={{
          campaignName: campaign.name,
          gmailAccountId: campaign.gmail_account_id,
          contactListId: "",
          targetContactIds: (campaign.campaign_contacts ?? [])
            .filter((contact) => contact.status !== "skipped")
            .map((contact) => contact.contact_id),
          timezone: campaign.timezone,
          sendWindowStart: campaign.send_window_start,
          sendWindowEnd: campaign.send_window_end,
          dailySendLimit: campaign.daily_send_limit,
          workflowDefinition: {
            steps: resolvedWorkflow.steps.map((step) => ({
              name: step.name,
              waitDays: step.waitDays,
              branchCondition: step.branchCondition,
              onMatch: step.onMatch,
              onNoMatch: step.onNoMatch,
              subject: step.subject,
              mode: step.mode,
              body: step.body,
              bodyHtml: step.bodyHtml,
            })),
          },
        }}
      />
    </div>
  );
}
