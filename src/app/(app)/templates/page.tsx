import { TemplateForm } from "@/components/forms/template-form";
import { PageHeader } from "@/components/layout/page-header";
import { SimpleDataTable } from "@/components/data-table/simple-data-table";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { listTemplates } from "@/services/campaign-service";

export default async function TemplatesPage() {
  const workspace = await getWorkspaceContext();
  const templates = (await listTemplates(workspace.workspaceId)) as Array<{
    id: string;
    name: string;
    subject_template: string;
    body_template: string;
    body_html_template?: string | null;
  }>;

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Templates"
        title="Reusable copy blocks"
        description="Save reusable text or HTML email templates with merge variables like {{first_name}}, {{company}}, and custom fields."
      />
      <TemplateForm />
      <SimpleDataTable
        title="Saved templates"
        rows={templates}
        columns={[
          { key: "name", header: "Name" },
          {
            key: "mode",
            header: "Mode",
            render: (row) => ((row.body_html_template as string | null | undefined) ? "HTML" : "Text"),
          },
          { key: "subject_template", header: "Subject" },
          {
            key: "body_preview",
            header: "Preview",
            render: (row) =>
              ((row.body_html_template as string | null | undefined)
                ? "Designed HTML template with text fallback"
                : String(row.body_template ?? "").slice(0, 120)),
          },
        ]}
      />
    </div>
  );
}
