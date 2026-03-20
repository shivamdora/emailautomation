import { TemplatesExperience } from "@/components/templates/templates-experience";
import { getWorkspaceContext } from "@/lib/db/workspace";
import type { TemplateListItem } from "@/lib/templates/gallery";
import { listTemplates } from "@/services/campaign-service";

export default async function TemplatesPage() {
  const workspace = await getWorkspaceContext();
  const templates = (await listTemplates(workspace.workspaceId, workspace.activeProjectId)) as TemplateListItem[];

  return <TemplatesExperience templates={templates} />;
}
