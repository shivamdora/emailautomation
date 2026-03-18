import { PageHeader } from "@/components/layout/page-header";
import { DeleteCampaignButton } from "@/components/campaigns/delete-campaign-button";
import { SendNowButton } from "@/components/campaigns/send-now-button";
import { SimpleDataTable } from "@/components/data-table/simple-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const campaign = (await getCampaignById(campaignId)) as {
    name: string;
    status: string;
    daily_send_limit: number;
    timezone: string;
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

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Campaign detail"
        title={campaign.name}
        description="Inspect contact-level queue state, follow-up timing, failures, and pause/resume actions."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={`/campaigns/${campaignId}/edit`}>Edit campaign</Link>
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
                {campaign.status === "active" ? "Pause campaign" : "Resume campaign"}
              </Button>
            </form>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/60 bg-card/90">
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent><Badge variant={campaign.status === "active" ? "success" : "neutral"}>{campaign.status}</Badge></CardContent>
        </Card>
        <Card className="border-border/60 bg-card/90">
          <CardHeader><CardTitle>Daily cap</CardTitle></CardHeader>
          <CardContent>{campaign.daily_send_limit}</CardContent>
        </Card>
        <Card className="border-border/60 bg-card/90">
          <CardHeader><CardTitle>Timezone</CardTitle></CardHeader>
          <CardContent>{campaign.timezone}</CardContent>
        </Card>
        <Card className="border-border/60 bg-card/90">
          <CardHeader><CardTitle>Window</CardTitle></CardHeader>
          <CardContent>{campaign.send_window_start ?? "09:00"} - {campaign.send_window_end ?? "17:00"}</CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {(campaign.campaign_steps ?? [])
          .slice()
          .sort((a, b) => a.step_number - b.step_number)
          .map((step) => (
            <Card key={step.step_number} className="border-border/60 bg-card/90">
              <CardHeader>
                <CardTitle>
                  Step {step.step_number}: {step.step_type === "follow_up" ? "Follow-up" : "Primary email"}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{step.body_html_template ? "HTML" : "Text"}</Badge>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Subject</p>
                  <p className="font-medium">{step.subject_template}</p>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Body preview</p>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {step.body_html_template ? "Stored as HTML with text fallback" : step.body_template}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
      <SimpleDataTable
        title="Campaign contacts"
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
