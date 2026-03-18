import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { PageHeader } from "@/components/layout/page-header";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { listTemplates } from "@/services/campaign-service";
import { getWorkspaceGmailAccounts } from "@/services/gmail-service";
import { listContacts } from "@/services/import-service";

export default async function NewCampaignPage() {
  const workspace = await getWorkspaceContext();
  const [rawGmailAccounts, rawContacts, rawTemplates] = await Promise.all([
    getWorkspaceGmailAccounts(workspace.workspaceId),
    listContacts(workspace.workspaceId),
    listTemplates(workspace.workspaceId),
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

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Campaign builder"
        title="Launch a campaign"
        description="Choose a mailbox, audience, and two-step sequence with text or HTML email content."
      />
      <CampaignWizard gmailAccounts={gmailAccounts} contacts={contacts} templates={templates} />
    </div>
  );
}
