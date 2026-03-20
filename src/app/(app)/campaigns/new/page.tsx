import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { PageHeader } from "@/components/layout/page-header";
import { productContent } from "@/content/product";
import { buildCampaignWizardInitialValues } from "@/lib/campaigns/wizard-defaults";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { listTemplates } from "@/services/campaign-service";
import { getWorkspaceGmailAccounts } from "@/services/gmail-service";
import { listContacts } from "@/services/import-service";

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
    listContacts(workspace.workspaceId, workspace.activeProjectId),
    listTemplates(workspace.workspaceId, workspace.activeProjectId),
  ]);
  const gmailAccounts = rawGmailAccounts as Array<{ id: string; email_address: string }>;
  const contacts = rawContacts;
  const templates = rawTemplates as Array<{
    id: string;
    name: string;
    subject_template: string;
    body_template: string;
    body_html_template?: string | null;
  }>;
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
