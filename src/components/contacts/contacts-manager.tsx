"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { productContent } from "@/content/product";
import type { ContactRecord, ContactTag } from "@/lib/types/contact";
import { contactUpdateSchema } from "@/lib/zod/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LiquidSelect } from "@/components/ui/liquid-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ContactsManagerProps = {
  initialContacts: ContactRecord[];
  initialTags: ContactTag[];
};

const checkboxClassName =
  "size-4 rounded border border-border/80 bg-white align-middle text-primary shadow-sm outline-none transition focus:ring-4 focus:ring-ring";

function parseTagInput(value: string) {
  return Array.from(
    new Map(
      value
        .split(/[;,\n]/g)
        .map((entry) => entry.trim().replace(/\s+/g, " "))
        .filter(Boolean)
        .map((entry) => [entry.toLowerCase(), entry]),
    ).values(),
  );
}

function ContactEditForm({
  contact,
  onCancel,
  onSaved,
}: {
  contact: ContactRecord;
  onCancel: () => void;
  onSaved: (contact: ContactRecord) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<z.input<typeof contactUpdateSchema>>({
    resolver: zodResolver(contactUpdateSchema),
    defaultValues: {
      email: contact.email,
      firstName: contact.first_name ?? "",
      lastName: contact.last_name ?? "",
      company: contact.company ?? "",
      website: contact.website ?? "",
      jobTitle: contact.job_title ?? "",
      tagNames: contact.tags?.map((tag) => tag.name) ?? [],
    },
  });
  const [tagValue, setTagValue] = useState((contact.tags ?? []).map((tag) => tag.name).join(", "));

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          tagNames: parseTagInput(tagValue),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(typeof payload?.error === "string" ? payload.error : productContent.contacts.editor.updateError);
        return;
      }

      toast.success(productContent.contacts.editor.updateSuccess);
      onSaved(payload.contact as ContactRecord);
    });
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 border-b border-white/56 bg-white/32 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-[1.65rem] tracking-[-0.05em]">{productContent.contacts.editor.title}</CardTitle>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {productContent.contacts.editor.close}
        </Button>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="editContactEmail">{productContent.contacts.manualForm.fields.email}</Label>
              <Input id="editContactEmail" {...form.register("email")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editContactCompany">{productContent.contacts.manualForm.fields.company}</Label>
              <Input id="editContactCompany" {...form.register("company")} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="editContactFirstName">{productContent.contacts.manualForm.fields.firstName}</Label>
              <Input id="editContactFirstName" {...form.register("firstName")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editContactLastName">{productContent.contacts.manualForm.fields.lastName}</Label>
              <Input id="editContactLastName" {...form.register("lastName")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editContactJobTitle">{productContent.contacts.manualForm.fields.jobTitle}</Label>
              <Input id="editContactJobTitle" {...form.register("jobTitle")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editContactWebsite">{productContent.contacts.manualForm.fields.website}</Label>
              <Input id="editContactWebsite" {...form.register("website")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editContactTags">{productContent.contacts.editor.tagsLabel}</Label>
            <Input
              id="editContactTags"
              value={tagValue}
              onChange={(event) => setTagValue(event.target.value)}
              placeholder={productContent.contacts.editor.tagsPlaceholder}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
              {productContent.contacts.editor.cancel}
            </Button>
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? productContent.contacts.editor.pendingLabel : productContent.contacts.editor.submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function ContactsManager({ initialContacts, initialTags }: ContactsManagerProps) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [tags, setTags] = useState(initialTags);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState("all");
  const [bulkTagValue, setBulkTagValue] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setContacts(initialContacts);
  }, [initialContacts]);

  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  const editingContact = useMemo(
    () => contacts.find((contact) => contact.id === editingContactId) ?? null,
    [contacts, editingContactId],
  );

  const filteredContacts = useMemo(() => {
    if (tagFilter === "all") {
      return contacts;
    }

    return contacts.filter((contact) =>
      (contact.tags ?? []).some((tag) => tag.name.toLowerCase() === tagFilter.toLowerCase()),
    );
  }, [contacts, tagFilter]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const unsubscribedCount = useMemo(
    () => contacts.filter((contact) => Boolean(contact.unsubscribed_at)).length,
    [contacts],
  );
  const selectedVisibleCount = useMemo(
    () => filteredContacts.filter((contact) => selectedSet.has(contact.id)).length,
    [filteredContacts, selectedSet],
  );

  function syncContact(updatedContact: ContactRecord) {
    setContacts((current) =>
      current.map((contact) => (contact.id === updatedContact.id ? updatedContact : contact)),
    );

    for (const tag of updatedContact.tags ?? []) {
      setTags((current) =>
        current.some((existing) => existing.id === tag.id) ? current : [...current, tag].sort((a, b) => a.name.localeCompare(b.name)),
      );
    }
  }

  function toggleSelection(contactId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, contactId])) : current.filter((value) => value !== contactId),
    );
  }

  function runBulkTagOperation(operation: "add" | "remove") {
    const tagNames = parseTagInput(bulkTagValue);

    if (!selectedIds.length) {
      toast.error(productContent.contacts.controls.selectionRequiredError);
      return;
    }

    if (!tagNames.length) {
      toast.error(productContent.contacts.controls.bulkTagsRequiredError);
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/contacts/bulk-tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactIds: selectedIds,
          operation,
          tagNames,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(typeof payload?.error === "string" ? payload.error : productContent.contacts.controls.updateTagsError);
        return;
      }

      router.refresh();
      toast.success(
        operation === "add"
          ? productContent.contacts.controls.addTagsSuccess
          : productContent.contacts.controls.removeTagsSuccess,
      );
      setBulkTagValue("");
    });
  }

  function handleBulkDelete() {
    if (!selectedIds.length) {
      toast.error(productContent.contacts.controls.selectionRequiredError);
      return;
    }

    if (!window.confirm(productContent.contacts.controls.deleteSelectedConfirm(selectedIds.length))) {
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/contacts/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contactIds: selectedIds }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(typeof payload?.error === "string" ? payload.error : productContent.contacts.controls.deleteSelectedError);
        return;
      }

      setSelectedIds([]);
      setEditingContactId(null);
      router.refresh();
      toast.success(productContent.contacts.controls.deleteSelectedSuccess);
    });
  }

  function handleDelete(contactId: string) {
    if (!window.confirm(productContent.contacts.table.deleteConfirm)) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(typeof payload?.error === "string" ? payload.error : productContent.contacts.table.deleteError);
        return;
      }

      setContacts((current) => current.filter((contact) => contact.id !== contactId));
      setSelectedIds((current) => current.filter((value) => value !== contactId));
      if (editingContactId === contactId) {
        setEditingContactId(null);
      }
      toast.success(productContent.contacts.table.deleteSuccess);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="grid gap-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-[1.85rem] tracking-[-0.05em]">{productContent.contacts.controls.title}</CardTitle>
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                    {productContent.contacts.controls.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="neutral">{filteredContacts.length} {productContent.contacts.controls.visibleLabel}</Badge>
                  <Badge variant="success">{contacts.length - unsubscribedCount} {productContent.contacts.controls.activeLabel}</Badge>
                  {selectedIds.length ? <Badge variant="warning">{selectedIds.length} {productContent.contacts.controls.selectedLabel}</Badge> : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="glass-control rounded-[24px] p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{productContent.contacts.controls.cards.contacts.eyebrow}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.05em]">{contacts.length}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{productContent.contacts.controls.cards.contacts.description}</p>
                </div>
                <div className="glass-control rounded-[24px] p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{productContent.contacts.controls.cards.selection.eyebrow}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.05em]">{selectedVisibleCount}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{productContent.contacts.controls.cards.selection.description}</p>
                </div>
                <div className="glass-control rounded-[24px] p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{productContent.contacts.controls.cards.tags.eyebrow}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.05em]">{tags.length}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{productContent.contacts.controls.cards.tags.description}</p>
                </div>
              </div>
            </div>

            <div className="glass-control grid gap-4 rounded-[26px] p-4 sm:p-5">
              <div className="grid gap-2">
                <Label htmlFor="contactsTagFilter">{productContent.contacts.controls.filterLabel}</Label>
                <LiquidSelect
                  id="contactsTagFilter"
                  value={tagFilter}
                  onValueChange={setTagFilter}
                  triggerClassName="h-12 rounded-[1.1rem]"
                  options={[
                    { value: "all", label: productContent.contacts.controls.filterAllLabel, description: "Show every contact" },
                    ...tags.map((tag) => ({
                      value: tag.name,
                      label: tag.name,
                      description: "Filter by tag",
                    })),
                  ]}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bulkTagsInput">{productContent.contacts.controls.bulkTagsLabel}</Label>
                <Input
                  id="bulkTagsInput"
                  value={bulkTagValue}
                  onChange={(event) => setBulkTagValue(event.target.value)}
                  placeholder={productContent.contacts.controls.bulkTagsPlaceholder}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="button" variant="outline" disabled={isPending} onClick={() => runBulkTagOperation("add")}>
                  {productContent.contacts.controls.addTags}
                </Button>
                <Button type="button" variant="outline" disabled={isPending} onClick={() => runBulkTagOperation("remove")}>
                  {productContent.contacts.controls.removeTags}
                </Button>
              </div>

              <Button type="button" variant="danger" disabled={isPending} onClick={handleBulkDelete} className="w-full">
                {productContent.contacts.controls.deleteSelected}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {editingContact ? (
        <ContactEditForm
          key={editingContact.id}
          contact={editingContact}
          onCancel={() => setEditingContactId(null)}
          onSaved={(contact) => {
            syncContact(contact);
            setEditingContactId(null);
            router.refresh();
          }}
        />
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 border-b border-white/56 bg-white/32 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-[1.7rem] tracking-[-0.05em]">{productContent.contacts.table.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {productContent.contacts.table.description}
            </p>
          </div>
          <Badge variant="neutral">{filteredContacts.length} {productContent.shared.rowsLabel}</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-[24px] border border-white/60 bg-white/46">
            <div className="scrollbar-none overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className={checkboxClassName}
                      checked={filteredContacts.length > 0 && filteredContacts.every((contact) => selectedSet.has(contact.id))}
                      onChange={(event) =>
                        setSelectedIds(
                          event.target.checked ? filteredContacts.map((contact) => contact.id) : [],
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>{productContent.contacts.table.columns.email}</TableHead>
                  <TableHead>{productContent.contacts.table.columns.name}</TableHead>
                  <TableHead>{productContent.contacts.table.columns.company}</TableHead>
                  <TableHead>{productContent.contacts.table.columns.tags}</TableHead>
                  <TableHead>{productContent.contacts.table.columns.status}</TableHead>
                  <TableHead>{productContent.contacts.table.columns.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.length ? (
                  filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className={checkboxClassName}
                          checked={selectedSet.has(contact.id)}
                          onChange={(event) => toggleSelection(contact.id, event.target.checked)}
                        />
                      </TableCell>
                      <TableCell className="font-semibold">{contact.email}</TableCell>
                      <TableCell>
                        {[contact.first_name, contact.last_name].filter(Boolean).join(" ") || productContent.contacts.table.noNameLabel}
                      </TableCell>
                      <TableCell>{contact.company ?? "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {(contact.tags ?? []).length ? (
                            (contact.tags ?? []).map((tag) => (
                              <Badge key={tag.id} variant="neutral">
                                {tag.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">{productContent.contacts.table.noTagsLabel}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.unsubscribed_at ? (
                          <Badge variant="danger">{productContent.contacts.table.unsubscribedStatusLabel}</Badge>
                        ) : (
                          <Badge variant="success">{productContent.contacts.table.activeStatusLabel}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditingContactId(contact.id)}>
                            {productContent.contacts.table.editLabel}
                          </Button>
                          <Button type="button" size="sm" variant="danger" onClick={() => handleDelete(contact.id)}>
                            {productContent.contacts.table.deleteLabel}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      {productContent.contacts.table.emptyLabel}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
