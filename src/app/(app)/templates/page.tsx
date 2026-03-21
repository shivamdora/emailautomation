import { TemplatesExperience } from "@/components/templates/templates-experience";
import { getCachedTemplates } from "@/lib/cache/read-models";
import { getWorkspaceContext } from "@/lib/db/workspace";
import type { TemplateListItem } from "@/lib/templates/gallery";

export default async function TemplatesPage() {
  const workspace = await getWorkspaceContext();
  const templates = (await getCachedTemplates(
    workspace.userId,
    workspace.workspaceId,
    workspace.activeProjectId,
  )) as TemplateListItem[];

  return <TemplatesExperience templates={templates} />;
}
