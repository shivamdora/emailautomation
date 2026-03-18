"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import type { ContactRecord, ContactTag } from "@/lib/types/contact";
import { contactUpdateSchema } from "@/lib/zod/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ContactsManagerProps = {
  initialContacts: ContactRecord[];
  initialTags: ContactTag[];
};

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
        toast.error(typeof payload?.error === "string" ? payload.error : "Failed to update contact");
        return;
      }

      toast.success("Contact updated");
      onSaved(payload.contact as ContactRecord);
    });
  });

  return (
    <Card className="border-border/60 bg-card/90">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Edit contact</CardTitle>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Close
        </Button>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="editContactEmail">Email</Label>
              <Input id="editContactEmail" {...form.register("email")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editContactCompany">Company</Label>
              <Input id="editContactCompany" {...form.register("company")} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="editContactFirstName">First name</Label>
              <Input id="editContactFirstName" {...form.register("firstName")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editContactLastName">Last name</Label>
              <Input id="editContactLastName" {...form.register("lastName")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editContactJobTitle">Job title</Label>
              <Input id="editContactJobTitle" {...form.register("jobTitle")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editContactWebsite">Website</Label>
              <Input id="editContactWebsite" {...form.register("website")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editContactTags">Tags</Label>
            <Input
              id="editContactTags"
              value={tagValue}
              onChange={(event) => setTagValue(event.target.value)}
              placeholder="vip, founders, q2"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
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
      toast.error("Select at least one contact first.");
      return;
    }

    if (!tagNames.length) {
      toast.error("Enter one or more tags.");
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
        toast.error(typeof payload?.error === "string" ? payload.error : "Failed to update tags");
        return;
      }

      router.refresh();
      toast.success(operation === "add" ? "Tags added" : "Tags removed");
      setBulkTagValue("");
    });
  }

  function handleBulkDelete() {
    if (!selectedIds.length) {
      toast.error("Select at least one contact first.");
      return;
    }

    if (!window.confirm(`Delete ${selectedIds.length} selected contact(s)?`)) {
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
        toast.error(typeof payload?.error === "string" ? payload.error : "Failed to delete contacts");
        return;
      }

      setSelectedIds([]);
      setEditingContactId(null);
      router.refresh();
      toast.success("Contacts deleted");
    });
  }

  function handleDelete(contactId: string) {
    if (!window.confirm("Delete this contact?")) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(typeof payload?.error === "string" ? payload.error : "Failed to delete contact");
        return;
      }

      setContacts((current) => current.filter((contact) => contact.id !== contactId));
      setSelectedIds((current) => current.filter((value) => value !== contactId));
      if (editingContactId === contactId) {
        setEditingContactId(null);
      }
      toast.success("Contact deleted");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      <Card className="border-border/60 bg-card/90">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <CardTitle>Contact controls</CardTitle>
            <p className="text-sm text-muted-foreground">
              Select rows to add or remove tags, or bulk delete stale contacts.
            </p>
          </div>
          <div className="grid gap-3 md:min-w-[24rem]">
            <div className="grid gap-2">
              <Label htmlFor="contactsTagFilter">Filter by tag</Label>
              <select
                id="contactsTagFilter"
                className="h-11 rounded-2xl border border-border bg-white/75 px-4 text-sm"
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
              >
                <option value="all">All contacts</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.name}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bulkTagsInput">Bulk tags</Label>
              <Input
                id="bulkTagsInput"
                value={bulkTagValue}
                onChange={(event) => setBulkTagValue(event.target.value)}
                placeholder="vip, founders, q2"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" disabled={isPending} onClick={() => runBulkTagOperation("add")}>
                Add tags
              </Button>
              <Button type="button" variant="outline" disabled={isPending} onClick={() => runBulkTagOperation("remove")}>
                Remove tags
              </Button>
              <Button type="button" variant="danger" disabled={isPending} onClick={handleBulkDelete}>
                Delete selected
              </Button>
            </div>
          </div>
        </CardHeader>
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

      <Card className="card-shadow border-border/60 bg-card/90">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Contacts</CardTitle>
          <Badge variant="neutral">{filteredContacts.length} rows</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={filteredContacts.length > 0 && filteredContacts.every((contact) => selectedSet.has(contact.id))}
                      onChange={(event) =>
                        setSelectedIds(
                          event.target.checked ? filteredContacts.map((contact) => contact.id) : [],
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.length ? (
                  filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedSet.has(contact.id)}
                          onChange={(event) => toggleSelection(contact.id, event.target.checked)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{contact.email}</TableCell>
                      <TableCell>
                        {[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown"}
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
                            <span className="text-sm text-muted-foreground">No tags</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.unsubscribed_at ? (
                          <Badge variant="danger">unsubscribed</Badge>
                        ) : (
                          <Badge variant="success">active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditingContactId(contact.id)}>
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="danger" onClick={() => handleDelete(contact.id)}>
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No contacts match this view yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
