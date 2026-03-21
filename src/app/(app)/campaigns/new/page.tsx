import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { PageHeader } from "@/components/layout/page-header";
import { productContent } from "@/content/product";
import { buildCampaignWizardInitialValues } from "@/lib/campaigns/wizard-defaults";
import { getCachedContacts, getCachedTemplates } from "@/lib/cache/read-models";
import { getWorkspaceContext } from "@/lib/db/workspace";
import type { TemplateListItem } from "@/lib/templates/gallery";
import { getWorkspaceGmailAccounts } from "@/services/gmail-service";

type NewCampaignPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewCampaignPage({ searchParams }: NewCampaignPageProps) {
  const workspace = await getWorkspaceContext();
  const params = (await searchParams) ?? {};
  const [rawGmailAccounts, rawContacts, rawTemplates] = await Promise.all([
    getWorkspaceGmailAccounts(workspace.workspaceId, {
      onlyApproved: true,
      projectId: workspace.activeProjectId,
    }),
    getCachedContacts(workspace.userId, workspace.workspaceId, workspace.activeProjectId),
    getCachedTemplates(workspace.userId, workspace.workspaceId, workspace.activeProjectId),
  ]);
  const gmailAccounts = rawGmailAccounts as Array<{ id: string; email_address: string }>;
  const contacts = rawContacts;
  const templates = rawTemplates as TemplateListItem[];
  const selectedTemplateId = typeof params.templateId === "string" ? params.templateId : null;

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={productContent.campaigns.newCampaign.eyebrow}
        title={productContent.campaigns.newCampaign.title}
        description={productContent.campaigns.newCampaign.description}
      />
      <CampaignWizard
        gmailAccounts={gmailAccounts}
        contacts={contacts}
        templates={templates}
        initialSelectedTemplateId={selectedTemplateId ?? undefined}
        initialValues={buildCampaignWizardInitialValues({
          gmailAccounts,
          contacts,
          templates,
          selectedTemplateId,
        })}
      />
    </div>
  );
}
