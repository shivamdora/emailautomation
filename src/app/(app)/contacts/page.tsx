import { PageHeader } from "@/components/layout/page-header";
import { productContent } from "@/content/product";
import { ContactsManager } from "@/components/contacts/contacts-manager";
import { ManualContactForm } from "@/components/forms/manual-contact-form";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { listContacts, listWorkspaceContactTags } from "@/services/import-service";

export default async function ContactsPage() {
  const workspace = await getWorkspaceContext();
  const [contacts, tags] = await Promise.all([
    listContacts(workspace.workspaceId, workspace.activeProjectId),
    listWorkspaceContactTags(workspace.workspaceId, workspace.activeProjectId),
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={productContent.contacts.header.eyebrow}
        title={productContent.contacts.header.title}
        description={productContent.contacts.header.description}
      />
      <ManualContactForm refreshOnSuccess />
      <ContactsManager initialContacts={contacts} initialTags={tags} />
    </div>
  );
}
