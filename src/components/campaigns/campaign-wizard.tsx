"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import type { Control, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import type { ContactRecord } from "@/lib/types/contact";
import { previewRenderedTemplate } from "@/lib/utils/template";
import { campaignLaunchSchema } from "@/lib/zod/schemas";
import { ManualContactForm } from "@/components/forms/manual-contact-form";
import { SafeHtmlContent } from "@/components/shared/safe-html-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type CampaignFormValues = z.input<typeof campaignLaunchSchema>;

type WizardProps = {
  gmailAccounts: Array<{ id: string; email_address: string }>;
  contacts: ContactRecord[];
  templates: Array<{
    id: string;
    name: string;
    subject_template: string;
    body_template: string;
    body_html_template?: string | null;
  }>;
  mode?: "create" | "edit";
  campaignId?: string;
  initialValues?: CampaignFormValues;
};

type StepEditorProps = {
  title: string;
  description: string;
  namePrefix: "primaryStep" | "followupStep";
  control: Control<CampaignFormValues>;
  register: UseFormRegister<CampaignFormValues>;
  previewContact: {
    first_name?: string | null;
    last_name?: string | null;
    company?: string | null;
    website?: string | null;
    job_title?: string | null;
    custom?: Record<string, string | number | boolean | null | undefined> | null;
  };
  setValue: UseFormSetValue<CampaignFormValues>;
  templates: WizardProps["templates"];
};

function getTemplateSnippet(template: {
  body_template: string;
  body_html_template?: string | null;
}) {
  if (template.body_html_template) {
    return "Designed HTML template with rendered layout and text fallback.";
  }

  return template.body_template.slice(0, 120) || "No preview yet.";
}

function CampaignStepEditor({
  title,
  description,
  namePrefix,
  control,
  register,
  previewContact,
  setValue,
  templates,
}: StepEditorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const mode = useWatch({ control, name: `${namePrefix}.mode` as const });
  const subject = useWatch({ control, name: `${namePrefix}.subject` as const });
  const body = useWatch({ control, name: `${namePrefix}.body` as const });
  const bodyHtml = useWatch({ control, name: `${namePrefix}.bodyHtml` as const });
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );
  const deferredPreview = useDeferredValue({ subject, body, bodyHtml, mode });
  const preview = useMemo(
    () =>
      previewRenderedTemplate({
        subjectTemplate: deferredPreview.subject ?? "",
        bodyTemplate: deferredPreview.body ?? "",
        bodyHtmlTemplate: deferredPreview.mode === "html" ? deferredPreview.bodyHtml ?? "" : null,
        contact: previewContact,
      }),
    [deferredPreview, previewContact],
  );

  return (
    <Card className="border-border/60 bg-card/90">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <Badge variant="neutral">{mode === "html" ? "HTML mode" : "Text mode"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
        <div className="grid gap-4">
          {templates.length ? (
            <div className="grid gap-3 rounded-[28px] border border-border/60 bg-background/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={`${namePrefix}-template`}>Saved template</Label>
                <span className="text-xs text-muted-foreground">
                  Selecting one will apply it immediately
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  id={`${namePrefix}-template`}
                  className="h-11 flex-1 rounded-2xl border border-border bg-white/75 px-4 text-sm"
                  value={selectedTemplateId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setSelectedTemplateId(nextId);
                    const nextTemplate = templates.find((template) => template.id === nextId);

                    if (!nextTemplate) {
                      return;
                    }

                    const templateMode = nextTemplate.body_html_template ? "html" : "text";
                    setValue(`${namePrefix}.mode` as const, templateMode, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setValue(`${namePrefix}.subject` as const, nextTemplate.subject_template, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setValue(`${namePrefix}.body` as const, nextTemplate.body_template ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setValue(`${namePrefix}.bodyHtml` as const, nextTemplate.body_html_template ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    toast.success(`Loaded ${nextTemplate.name}`);
                  }}
                >
                  <option value="">Choose a template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.body_html_template ? "(HTML)" : "(Text)"}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">
                    {selectedTemplate?.body_html_template ? "HTML" : selectedTemplate ? "Text" : `${templates.length} saved`}
                  </Badge>
                </div>
              </div>
              {selectedTemplate ? (
                <div className="rounded-3xl border border-border/60 bg-card/80 px-4 py-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{selectedTemplate.subject_template}</p>
                  <p className="mt-1 leading-6">{getTemplateSnippet(selectedTemplate)}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label>Composer mode</Label>
            <Tabs
              value={mode ?? "text"}
              onValueChange={(value) => setValue(`${namePrefix}.mode` as const, value as "text" | "html", { shouldDirty: true })}
            >
              <TabsList>
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="html">HTML</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${namePrefix}-subject`}>Subject</Label>
            <Input id={`${namePrefix}-subject`} {...register(`${namePrefix}.subject` as const)} />
          </div>
          {mode === "html" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor={`${namePrefix}-html`}>HTML body</Label>
                <Textarea
                  id={`${namePrefix}-html`}
                  className="min-h-60 font-mono text-xs"
                  {...register(`${namePrefix}.bodyHtml` as const)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${namePrefix}-file`}>Import HTML file</Label>
                <Input
                  id={`${namePrefix}-file`}
                  type="file"
                  accept=".html,.htm,text/html"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }

                    void file.text().then((value) => {
                      setValue(`${namePrefix}.mode` as const, "html", { shouldDirty: true });
                      setValue(`${namePrefix}.bodyHtml` as const, value, { shouldDirty: true, shouldValidate: true });
                    });
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${namePrefix}-fallback`}>Text fallback</Label>
                <Textarea
                  id={`${namePrefix}-fallback`}
                  className="min-h-36"
                  placeholder="Optional plain-text fallback. Leave blank to auto-generate."
                  {...register(`${namePrefix}.body` as const)}
                />
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor={`${namePrefix}-body`}>Body</Label>
              <Textarea id={`${namePrefix}-body`} className="min-h-60" {...register(`${namePrefix}.body` as const)} />
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-border/60 bg-background/70 p-5 lg:sticky lg:top-6 lg:self-start">
          <Tabs defaultValue="rendered" className="grid gap-4">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="rendered">Preview</TabsTrigger>
              <TabsTrigger value="text">Text</TabsTrigger>
            </TabsList>
            <TabsContent value="rendered" className="mt-0">
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Subject</p>
                <p className="text-base font-semibold">{preview.subject || "No subject yet"}</p>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Body</p>
                {mode === "html" && preview.bodyHtml ? (
                  <div className="overflow-hidden rounded-3xl border border-border/60 bg-white p-4 text-sm leading-6 text-slate-700">
                    <SafeHtmlContent html={preview.bodyHtml} />
                  </div>
                ) : (
                  <div className="rounded-3xl border border-border/60 bg-background/80 p-4 text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
                    {preview.body || "No body yet"}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="text" className="mt-0">
              <div className="rounded-3xl border border-border/60 bg-background/80 p-4 text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
                {preview.textFallback || "No text preview yet"}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}

export function CampaignWizard({
  gmailAccounts,
  contacts,
  templates,
  mode = "create",
  campaignId,
  initialValues,
}: WizardProps) {
  const [availableContacts, setAvailableContacts] = useState(contacts);
  const [contactQuery, setContactQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignLaunchSchema),
    defaultValues:
      initialValues ?? {
        campaignName: "",
        gmailAccountId: gmailAccounts[0]?.id ?? "",
        contactListId: "",
        targetContactIds: contacts.slice(0, 3).map((contact) => contact.id),
        timezone: "Asia/Calcutta",
        sendWindowStart: "09:00",
        sendWindowEnd: "17:00",
        dailySendLimit: 25,
        primaryStep: {
          subject: "Quick idea for {{company}}",
          mode: "text",
          body: "Hi {{first_name}},\n\nThought this might be relevant for {{company}}.\n\nBest,\nJay",
          bodyHtml: "",
        },
        followupStep: {
          subject: "Following up on my note",
          mode: "text",
          body: "Hi {{first_name}},\n\nBumping this once in case it got buried.\n\nBest,\nJay",
          bodyHtml: "",
        },
      },
  });
  const watchedTargetContactIds = useWatch({
    control: form.control,
    name: "targetContactIds",
  });
  const targetContactIds = useMemo(() => watchedTargetContactIds ?? [], [watchedTargetContactIds]);
  const filteredContacts = useMemo(() => {
    const normalizedQuery = contactQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return availableContacts;
    }

    return availableContacts.filter((contact) =>
      [
        contact.email,
        contact.first_name,
        contact.last_name,
        contact.company,
        contact.job_title,
        ...(contact.tags ?? []).map((tag) => tag.name),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [availableContacts, contactQuery]);

  const previewContact = useMemo(() => {
    const selectedContact = availableContacts.find((contact) => targetContactIds.includes(contact.id));
    return {
      first_name: selectedContact?.first_name ?? "Alina",
      last_name: selectedContact?.last_name ?? "Stone",
      company: selectedContact?.company ?? "Northstar",
      website: selectedContact?.website ?? "northstar.dev",
      job_title: selectedContact?.job_title ?? "Founder",
      custom: (selectedContact?.custom_fields_jsonb as Record<string, string | number | boolean | null | undefined> | null | undefined) ?? null,
    };
  }, [availableContacts, targetContactIds]);

  function handleContactCreated(contact: ContactRecord) {
    setAvailableContacts((current) => [contact, ...current.filter((item) => item.id !== contact.id)]);
    form.setValue("targetContactIds", [...new Set([...form.getValues("targetContactIds"), contact.id])], {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function submitCampaign(sendNow: boolean) {
    return form.handleSubmit((values) => {
      startTransition(async () => {
        const url = mode === "edit" && campaignId ? `/api/campaigns/${campaignId}` : "/api/campaigns/launch";
        const method = mode === "edit" ? "PUT" : "POST";
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(values),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          toast.error(payload?.error ?? `Failed to ${mode === "edit" ? "update" : "launch"} campaign`);
          return;
        }

        const resolvedCampaignId = (payload?.id as string | undefined) ?? campaignId;

        if (!resolvedCampaignId) {
          toast.error("Campaign was saved without a valid ID.");
          return;
        }

        if (mode === "edit") {
          toast.success("Campaign updated");
          window.location.href = `/campaigns/${resolvedCampaignId}`;
          return;
        }

        if (!sendNow) {
          toast.success("Campaign launched");
          window.location.href = `/campaigns/${resolvedCampaignId}`;
          return;
        }

        const sendResponse = await fetch("/api/campaigns/send-now", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ campaignId: resolvedCampaignId }),
        });
        const sendPayload = await sendResponse.json().catch(() => null);

        if (!sendResponse.ok) {
          toast.error(typeof sendPayload?.error === "string" ? sendPayload.error : "Campaign created, but send now failed");
          window.location.href = `/campaigns/${resolvedCampaignId}`;
          return;
        }

        const processed = Number(sendPayload?.processed ?? 0);
        toast.success(
          processed > 0
            ? `Campaign launched and sent to ${processed} contact${processed === 1 ? "" : "s"}.`
            : "Campaign launched. No contacts were ready to send yet.",
        );
        window.location.href = `/campaigns/${resolvedCampaignId}`;
      });
    })();
  }

  return (
    <Card className="border-border/60 bg-card/90">
      <CardHeader>
        <CardTitle>{mode === "edit" ? "Edit campaign" : "Campaign builder"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-8"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCampaign(false);
          }}
        >
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Audience
              </p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{targetContactIds.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                contacts selected for this campaign
              </p>
            </div>
            <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Templates
              </p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{templates.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                saved text or HTML templates ready to apply
              </p>
            </div>
            <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Mailboxes
              </p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{gmailAccounts.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                connected senders available for launch
              </p>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="campaignName">Campaign name</Label>
              <Input id="campaignName" {...form.register("campaignName")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gmailAccountId">Sender mailbox</Label>
              <select
                id="gmailAccountId"
                className="h-11 rounded-2xl border border-border bg-white/75 px-4 text-sm"
                {...form.register("gmailAccountId")}
              >
                {gmailAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.email_address}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="grid gap-1">
                  <Label htmlFor="contact-search">Target contacts</Label>
                  <span className="text-xs text-muted-foreground">
                    {targetContactIds.length} selected across the full list
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      form.setValue(
                        "targetContactIds",
                        [...new Set([...form.getValues("targetContactIds"), ...filteredContacts.map((contact) => contact.id)])],
                        { shouldDirty: true, shouldValidate: true },
                      )
                    }
                  >
                    Select visible
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      form.setValue("targetContactIds", [], {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    Clear selection
                  </Button>
                </div>
              </div>
              <Input
                id="contact-search"
                placeholder="Search by email, name, company, title, or tag"
                value={contactQuery}
                onChange={(event) => setContactQuery(event.target.value)}
              />
              <div className="grid max-h-[28rem] gap-2 overflow-auto rounded-[28px] border border-border/60 bg-background/60 p-4">
                {filteredContacts.length ? (
                  filteredContacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex items-start gap-3 rounded-2xl border border-transparent px-3 py-3 text-sm transition hover:border-border/60 hover:bg-muted/30"
                    >
                      <input
                        type="checkbox"
                        value={contact.id}
                        checked={targetContactIds.includes(contact.id)}
                        onChange={(event) => {
                          const current = form.getValues("targetContactIds");
                          form.setValue(
                            "targetContactIds",
                            event.target.checked
                              ? [...current, contact.id]
                              : current.filter((value) => value !== contact.id),
                            { shouldDirty: true, shouldValidate: true },
                          );
                        }}
                      />
                      <span className="grid gap-1">
                        <span className="font-medium">{contact.email}</span>
                        <span className="text-xs text-muted-foreground">
                          {[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "No name"}
                          {contact.company ? ` - ${contact.company}` : ""}
                        </span>
                        {(contact.tags ?? []).length ? (
                          <span className="flex flex-wrap gap-2">
                            {(contact.tags ?? []).slice(0, 3).map((tag) => (
                              <Badge key={tag.id} variant="neutral">
                                {tag.name}
                              </Badge>
                            ))}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
                    {availableContacts.length
                      ? "No contacts match this search yet."
                      : "No contacts yet. Add one manually here or import contacts first."}
                  </div>
                )}
              </div>
            </div>
            <ManualContactForm
              title="Add contact inline"
              description="Create a contact without leaving the campaign builder. New contacts are selected automatically."
              submitLabel="Add and select"
              onCreated={handleContactCreated}
              asForm={false}
            />
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" {...form.register("timezone")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sendWindowStart">Start</Label>
              <Input id="sendWindowStart" {...form.register("sendWindowStart")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sendWindowEnd">End</Label>
              <Input id="sendWindowEnd" {...form.register("sendWindowEnd")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dailySendLimit">Daily cap</Label>
              <Input id="dailySendLimit" type="number" {...form.register("dailySendLimit")} />
            </div>
          </section>

          <CampaignStepEditor
            title="Primary email"
            description="Draft the first touch as text or full HTML. Merge tags like {{first_name}} and {{company}} work in both modes."
            namePrefix="primaryStep"
            control={form.control}
            register={form.register}
            previewContact={previewContact}
            setValue={form.setValue}
            templates={templates}
          />
          <CampaignStepEditor
            title="Follow-up"
            description="This step uses the fixed follow-up delay from your workspace configuration and can have its own HTML mode."
            namePrefix="followupStep"
            control={form.control}
            register={form.register}
            previewContact={previewContact}
            setValue={form.setValue}
            templates={templates}
          />

          <div className="flex flex-wrap justify-end gap-3">
            {mode === "create" ? (
              <Button type="button" variant="outline" disabled={isPending} onClick={() => void submitCampaign(true)}>
                {isPending ? "Launching..." : "Launch and send now"}
              </Button>
            ) : null}
            <Button type="submit" disabled={isPending}>
              {isPending ? (mode === "edit" ? "Saving..." : "Launching...") : mode === "edit" ? "Save changes" : "Launch campaign"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
