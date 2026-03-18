import { PageHeader } from "@/components/layout/page-header";
import { ContactsManager } from "@/components/contacts/contacts-manager";
import { ManualContactForm } from "@/components/forms/manual-contact-form";
import { getWorkspaceContext } from "@/lib/db/workspace";
import { listContacts, listWorkspaceContactTags } from "@/services/import-service";

export default async function ContactsPage() {
  const workspace = await getWorkspaceContext();
  const [contacts, tags] = await Promise.all([
    listContacts(workspace.workspaceId),
    listWorkspaceContactTags(workspace.workspaceId),
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Contacts"
        title="Unified leads table"
        description="Workspace-scoped contacts from manual entry, CSV/XLSX, Sheets, and future CRM adapters."
      />
      <ManualContactForm refreshOnSuccess />
      <ContactsManager initialContacts={contacts} initialTags={tags} />
    </div>
  );
}
