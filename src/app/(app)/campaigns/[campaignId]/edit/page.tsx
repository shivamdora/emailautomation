import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { PageHeader } from "@/components/layout/page-header";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { getCampaignForEditing, listTemplates } from "@/services/campaign-service";
import { getWorkspaceGmailAccounts } from "@/services/gmail-service";
import { listContacts } from "@/services/import-service";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const workspace = await getWorkspaceContext();
  const [campaign, rawGmailAccounts, contacts, rawTemplates] = await Promise.all([
    getCampaignForEditing(campaignId, workspace.workspaceId),
    getWorkspaceGmailAccounts(workspace.workspaceId),
    listContacts(workspace.workspaceId),
    listTemplates(workspace.workspaceId),
  ]);
  const gmailAccounts = rawGmailAccounts as Array<{ id: string; email_address: string }>;
  const templates = rawTemplates as Array<{
    id: string;
    name: string;
    subject_template: string;
    body_template: string;
    body_html_template?: string | null;
  }>;
  const steps = [...(campaign.campaign_steps ?? [])].sort((a, b) => a.step_number - b.step_number);
  const primaryStep = steps.find((step) => step.step_number === 1);
  const followupStep = steps.find((step) => step.step_number === 2);

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Campaign editor"
        title={`Edit ${campaign.name}`}
        description="Update the mailbox, audience, schedule, and future email content without losing send history."
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
          primaryStep: {
            subject: primaryStep?.subject_template ?? "",
            mode: primaryStep?.body_html_template ? "html" : "text",
            body: primaryStep?.body_template ?? "",
            bodyHtml: primaryStep?.body_html_template ?? "",
          },
          followupStep: {
            subject: followupStep?.subject_template ?? "",
            mode: followupStep?.body_html_template ? "html" : "text",
            body: followupStep?.body_template ?? "",
            bodyHtml: followupStep?.body_html_template ?? "",
          },
        }}
      />
    </div>
  );
}
