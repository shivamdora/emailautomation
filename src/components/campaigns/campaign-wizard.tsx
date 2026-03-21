"use client";

import Link from "next/link";
import { useDeferredValue, useId, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Mail,
  Plus,
  Search,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { ContactRecord } from "@/lib/types/contact";
import { cn } from "@/lib/utils";
import {
  buildLaunchChecklist,
  campaignCreatorSteps,
  describeWorkflowRoute,
  formatSendWindowSummary,
  getSendWindowPresetId,
  isAdvancedWorkflow,
  matchesTemplateIntent,
  sendWindowPresets,
  type CampaignTemplateIntent,
  type CampaignCreatorStepId,
} from "@/lib/campaigns/creator";
import {
  buildCampaignWizardInitialValues,
  buildDefaultWorkflowStep,
  type CampaignFormValues,
} from "@/lib/campaigns/wizard-defaults";
import type { TemplateListItem } from "@/lib/templates/gallery";
import type { WorkflowStepInput } from "@/lib/workflows/definition";
import { campaignBuilderSchema } from "@/lib/zod/schemas";
import { creatorCopy, commonTimezoneOptions } from "@/components/campaigns/campaign-creator-copy";
import {
  FieldError,
  StarterCard,
  SummaryRail,
  TemplateChooserDialog,
  getTemplateSnippet,
} from "@/components/campaigns/campaign-creator-shared";
import { CampaignMessageCard } from "@/components/campaigns/campaign-message-card";
import { ManualContactForm } from "@/components/forms/manual-contact-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LiquidSelect } from "@/components/ui/liquid-select";
import { Textarea } from "@/components/ui/textarea";

type StarterType = "template" | "scratch";
type TemplateDialogState = {
  open: boolean;
  intent: CampaignTemplateIntent;
  stepIndex: number;
  title: string;
  description: string;
};

type WizardProps = {
  gmailAccounts: Array<{ id: string; email_address: string }>;
  contacts: ContactRecord[];
  templates: TemplateListItem[];
  mode?: "create" | "edit";
  campaignId?: string;
  initialValues?: CampaignFormValues;
  initialSelectedTemplateId?: string;
};

export function CampaignWizard({
  gmailAccounts,
  contacts,
  templates,
  mode = "create",
  campaignId,
  initialValues,
  initialSelectedTemplateId,
}: WizardProps) {
  const resolvedInitialValues = useMemo(() => {
    const baseValues =
      initialValues ??
      buildCampaignWizardInitialValues({
        gmailAccounts,
        contacts,
        templates,
        selectedTemplateId: initialSelectedTemplateId,
      });

    const steps = [...(baseValues.workflowDefinition.steps ?? [])];
    while (steps.length < 2) {
      steps.push(buildDefaultWorkflowStep(steps.length));
    }

    return {
      ...baseValues,
      workflowDefinition: { steps },
    } satisfies CampaignFormValues;
  }, [contacts, gmailAccounts, initialSelectedTemplateId, initialValues, templates]);

  const findMatchingTemplateId = useMemo(
    () => (step: CampaignFormValues["workflowDefinition"]["steps"][number] | undefined, intent: CampaignTemplateIntent) => {
      if (!step) {
        return "";
      }

      const matchingTemplate = templates.find((template) => {
        return (
          matchesTemplateIntent(template, intent) &&
          template.subject_template === step.subject &&
          (template.body_html_template ?? "") === (step.bodyHtml ?? "") &&
          (template.body_template ?? "") === (step.body ?? "")
        );
      });

      return matchingTemplate?.id ?? "";
    },
    [templates],
  );

  const initialPrimaryTemplateId = useMemo(() => {
    if (initialSelectedTemplateId) {
      return initialSelectedTemplateId;
    }

    return findMatchingTemplateId(resolvedInitialValues.workflowDefinition.steps[0], "primary");
  }, [findMatchingTemplateId, initialSelectedTemplateId, resolvedInitialValues.workflowDefinition.steps]);

  const initialFollowUpTemplateId = useMemo(
    () => findMatchingTemplateId(resolvedInitialValues.workflowDefinition.steps[1], "follow-up"),
    [findMatchingTemplateId, resolvedInitialValues.workflowDefinition.steps],
  );

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [starterType, setStarterType] = useState<StarterType>(initialPrimaryTemplateId ? "template" : "scratch");
  const [selectedPrimaryTemplateId, setSelectedPrimaryTemplateId] = useState(initialPrimaryTemplateId);
  const [selectedFollowUpTemplateId, setSelectedFollowUpTemplateId] = useState(initialFollowUpTemplateId);
  const [templateDialogState, setTemplateDialogState] = useState<TemplateDialogState>({
    open: false,
    intent: "primary",
    stepIndex: 0,
    title: creatorCopy.start.templateDialogTitle,
    description: creatorCopy.start.templateDialogDescription,
  });
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [starterError, setStarterError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(() =>
    isAdvancedWorkflow(resolvedInitialValues.workflowDefinition.steps as WorkflowStepInput[]),
  );
  const [isPending, startTransition] = useTransition();
  const timezoneListId = useId();

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignBuilderSchema),
    defaultValues: resolvedInitialValues,
  });
  const stepFields = useFieldArray({ control: form.control, name: "workflowDefinition.steps" });
  const workflowSteps = (useWatch({ control: form.control, name: "workflowDefinition.steps" }) ??
    []) as CampaignFormValues["workflowDefinition"]["steps"];
  const typedWorkflowSteps = workflowSteps as WorkflowStepInput[];
  const watchedTargetContactIds = useWatch({
    control: form.control,
    name: "targetContactIds",
  }) as string[] | undefined;
  const gmailAccountId = (useWatch({ control: form.control, name: "gmailAccountId" }) ?? "") as string;
  const timezone = (useWatch({ control: form.control, name: "timezone" }) ?? "") as string;
  const sendWindowStart = (useWatch({ control: form.control, name: "sendWindowStart" }) ?? "") as string;
  const sendWindowEnd = (useWatch({ control: form.control, name: "sendWindowEnd" }) ?? "") as string;
  const dailySendLimit = Number(useWatch({ control: form.control, name: "dailySendLimit" }) ?? 0);
  const primaryStep = typedWorkflowSteps[0];
  const followUpStep = typedWorkflowSteps[1];
  const hasMailbox = gmailAccounts.length > 0;
  const activeStep = campaignCreatorSteps[currentStepIndex];
  const targetContactIds = useMemo(() => watchedTargetContactIds ?? [], [watchedTargetContactIds]);

  const [availableContacts, setAvailableContacts] = useState(contacts);
  const deferredContactQuery = useDeferredValue(contactQuery);
  const filteredContacts = useMemo(() => {
    const query = deferredContactQuery.trim().toLowerCase();
    if (!query) {
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
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [availableContacts, deferredContactQuery]);

  const previewContact = useMemo(() => {
    const selectedContact = availableContacts.find((contact) => targetContactIds.includes(contact.id));
    return {
      first_name: selectedContact?.first_name ?? "Alina",
      last_name: selectedContact?.last_name ?? "Stone",
      company: selectedContact?.company ?? "Northstar",
      website: selectedContact?.website ?? "northstar.dev",
      job_title: selectedContact?.job_title ?? "Founder",
      custom:
        (selectedContact?.custom_fields_jsonb as
          | Record<string, string | number | boolean | null | undefined>
          | null
          | undefined) ?? null,
    };
  }, [availableContacts, targetContactIds]);

  const selectedPrimaryTemplate = templates.find((template) => template.id === selectedPrimaryTemplateId) ?? null;
  const selectedFollowUpTemplate = templates.find((template) => template.id === selectedFollowUpTemplateId) ?? null;
  const selectedSenderEmail =
    gmailAccounts.find((account) => account.id === gmailAccountId)?.email_address ?? null;
  const checklist = buildLaunchChecklist({
    hasSender: Boolean(selectedSenderEmail),
    selectedContactsCount: targetContactIds.length,
    primaryStep: primaryStep as WorkflowStepInput | undefined,
    followUpStep: followUpStep as WorkflowStepInput | undefined,
  });
  const reviewReady = checklist.every((item) => item.complete);
  const sendWindowSummary = formatSendWindowSummary(timezone, sendWindowStart, sendWindowEnd);
  const sendWindowPresetId = getSendWindowPresetId(sendWindowStart, sendWindowEnd);

  function openTemplateDialog(
    intent: CampaignTemplateIntent,
    stepIndex: number,
    title: string,
    description: string,
  ) {
    setTemplateDialogState({
      open: true,
      intent,
      stepIndex,
      title,
      description,
    });
  }

  function applyTemplateToStep(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    if (templateDialogState.stepIndex === 0) {
      setStarterType("template");
      setSelectedPrimaryTemplateId(templateId);
      setStarterError(null);
    } else if (templateDialogState.stepIndex === 1) {
      setSelectedFollowUpTemplateId(templateId);
    }

    form.setValue(`workflowDefinition.steps.${templateDialogState.stepIndex}.subject` as never, template.subject_template as never, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue(`workflowDefinition.steps.${templateDialogState.stepIndex}.body` as never, (template.body_template ?? "") as never, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue(
      `workflowDefinition.steps.${templateDialogState.stepIndex}.bodyHtml` as never,
      (template.body_html_template ?? "") as never,
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue(
      `workflowDefinition.steps.${templateDialogState.stepIndex}.mode` as never,
      (template.body_html_template ? "html" : "text") as never,
      { shouldDirty: true, shouldValidate: true },
    );
    toast.success(creatorCopy.toasts.templateApplied(template.name));
  }

  function resetPrimaryStepToScratch() {
    const defaultStep = buildDefaultWorkflowStep(0);
    setStarterType("scratch");
    setSelectedPrimaryTemplateId("");
    setStarterError(null);
    form.setValue(`workflowDefinition.steps.0.subject` as never, defaultStep.subject as never, { shouldDirty: true, shouldValidate: true });
    form.setValue(`workflowDefinition.steps.0.body` as never, defaultStep.body as never, { shouldDirty: true, shouldValidate: true });
    form.setValue(`workflowDefinition.steps.0.bodyHtml` as never, defaultStep.bodyHtml as never, { shouldDirty: true, shouldValidate: true });
    form.setValue(`workflowDefinition.steps.0.mode` as never, defaultStep.mode as never, { shouldDirty: true, shouldValidate: true });
  }

  function handleContactCreated(contact: ContactRecord) {
    setAvailableContacts((current) => [contact, ...current.filter((item) => item.id !== contact.id)]);
    form.setValue("targetContactIds", [...new Set([...form.getValues("targetContactIds"), contact.id])], {
      shouldDirty: true,
      shouldValidate: true,
    });
    setContactDialogOpen(false);
  }

  function handleAddStep() {
    const steps = form.getValues("workflowDefinition.steps");
    const lastIndex = steps.length - 1;
    if (lastIndex >= 0) {
      form.setValue(`workflowDefinition.steps.${lastIndex}.onMatch` as never, "next_step" as never, { shouldDirty: true });
      form.setValue(`workflowDefinition.steps.${lastIndex}.onNoMatch` as never, "next_step" as never, { shouldDirty: true });
    }
    stepFields.append(buildDefaultWorkflowStep(steps.length));
    setAdvancedOpen(true);
  }

  function handleRemoveStep(index: number) {
    const nextSteps = [...form.getValues("workflowDefinition.steps")];
    nextSteps.splice(index, 1);
    stepFields.remove(index);
    if (nextSteps.length) {
      const lastIndex = nextSteps.length - 1;
      form.setValue(`workflowDefinition.steps.${lastIndex}.onMatch` as never, "exit_sequence" as never, { shouldDirty: true });
      form.setValue(`workflowDefinition.steps.${lastIndex}.onNoMatch` as never, "exit_sequence" as never, { shouldDirty: true });
    }
  }

  async function validateCurrentStep() {
    if (activeStep.id === "start") {
      const validName = await form.trigger("campaignName");
      if (starterType === "template" && !selectedPrimaryTemplateId) {
        setStarterError("Choose a template to continue.");
        return false;
      }
      setStarterError(null);
      return validName;
    }

    if (activeStep.id === "audience") {
      const isValid = await form.trigger("targetContactIds");
      if (!isValid) {
        form.setError("targetContactIds", { type: "manual", message: creatorCopy.audience.continueError });
      }
      return isValid;
    }

    if (activeStep.id === "message") {
      const validationPaths = workflowSteps.flatMap((step, index) => {
        return (step?.mode ?? "text") === "html"
          ? [`workflowDefinition.steps.${index}.subject`, `workflowDefinition.steps.${index}.bodyHtml`]
          : [`workflowDefinition.steps.${index}.subject`, `workflowDefinition.steps.${index}.body`];
      });
      return form.trigger(validationPaths as never);
    }

    return true;
  }

  function jumpToStep(stepId: CampaignCreatorStepId) {
    const nextIndex = campaignCreatorSteps.findIndex((step) => step.id === stepId);
    if (nextIndex >= 0) {
      setCurrentStepIndex(nextIndex);
    }
  }

  async function goToNextStep() {
    const valid = await validateCurrentStep();
    if (valid) {
      setCurrentStepIndex((current) => Math.min(campaignCreatorSteps.length - 1, current + 1));
    }
  }

  function goToPreviousStep() {
    setCurrentStepIndex((current) => Math.max(0, current - 1));
  }

  function setSendWindowPreset(presetId: (typeof sendWindowPresets)[number]["id"]) {
    const preset = sendWindowPresets.find((item) => item.id === presetId);
    if (!preset || preset.id === "custom") {
      return;
    }
    form.setValue("sendWindowStart", preset.start, { shouldDirty: true, shouldValidate: true });
    form.setValue("sendWindowEnd", preset.end, { shouldDirty: true, shouldValidate: true });
  }

  function adjustDailyCap(delta: number) {
    const nextValue = Math.max(1, Math.min(500, Number(form.getValues("dailySendLimit") ?? 0) + delta));
    form.setValue("dailySendLimit", nextValue, { shouldDirty: true, shouldValidate: true });
  }

  function submitCampaign(sendNow: boolean) {
    return form.handleSubmit((values) => {
      startTransition(async () => {
        const url = mode === "edit" && campaignId ? `/api/campaigns/${campaignId}` : "/api/campaigns/launch";
        const method = mode === "edit" ? "PUT" : "POST";
        const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          toast.error(payload?.error ?? (mode === "edit" ? creatorCopy.toasts.updateError : creatorCopy.toasts.launchError));
          return;
        }

        const resolvedCampaignId = (payload?.id as string | undefined) ?? campaignId;
        if (!resolvedCampaignId) {
          toast.error(creatorCopy.toasts.missingCampaignId);
          return;
        }

        if (mode === "edit") {
          toast.success(creatorCopy.toasts.updated);
          window.location.href = `/campaigns/${resolvedCampaignId}`;
          return;
        }

        if (!sendNow) {
          toast.success(creatorCopy.toasts.launched);
          window.location.href = `/campaigns/${resolvedCampaignId}`;
          return;
        }

        const sendResponse = await fetch("/api/campaigns/send-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId: resolvedCampaignId }),
        });
        const sendPayload = await sendResponse.json().catch(() => null);
        if (!sendResponse.ok) {
          toast.error(typeof sendPayload?.error === "string" ? sendPayload.error : creatorCopy.toasts.sendNowFailed);
          window.location.href = `/campaigns/${resolvedCampaignId}`;
          return;
        }

        const processed = Number(sendPayload?.processed ?? 0);
        toast.success(processed > 0 ? creatorCopy.toasts.launchedAndSent(processed) : creatorCopy.toasts.launchedNoReadyContacts);
        window.location.href = `/campaigns/${resolvedCampaignId}`;
      });
    })();
  }

  return (
    <>
      <TemplateChooserDialog open={templateDialogState.open} onOpenChange={(open) => setTemplateDialogState((current) => ({ ...current, open }))} templates={templates} selectedTemplateId={templateDialogState.stepIndex === 1 ? selectedFollowUpTemplateId : selectedPrimaryTemplateId} onSelect={applyTemplateToStep} intent={templateDialogState.intent} title={templateDialogState.title} description={templateDialogState.description} />
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{creatorCopy.audience.addContactTitle}</DialogTitle>
            <DialogDescription>New contacts are selected automatically when you save them.</DialogDescription>
          </DialogHeader>
          <ManualContactForm title={creatorCopy.audience.addContactTitle} description="Add a contact here and keep building the campaign." submitLabel="Add and select" onCreated={handleContactCreated} />
        </DialogContent>
      </Dialog>

      <form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" onSubmit={(event) => { event.preventDefault(); if (activeStep.id === "review") { void submitCampaign(false); } }}>
        <div className="grid gap-6">
          <Card className="overflow-hidden">
            <CardContent className="grid gap-6 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-3">
                {campaignCreatorSteps.map((step, index) => {
                  const isActive = index === currentStepIndex;
                  const isComplete = index < currentStepIndex;
                  return (
                    <button key={step.id} type="button" onClick={() => { if (index <= currentStepIndex) setCurrentStepIndex(index); }} className={cn("flex min-w-[9rem] flex-1 items-center gap-3 rounded-[1.4rem] border px-4 py-3 text-left transition-all duration-200", isActive ? "border-white/90 bg-[linear-gradient(180deg,rgba(215,237,247,0.72),rgba(255,255,255,0.88))] shadow-[0_18px_32px_rgba(17,39,63,0.12)]" : isComplete ? "border-white/72 bg-white/68 hover:bg-white/82" : "border-white/60 bg-white/42 text-muted-foreground")}>
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border", isActive || isComplete ? "border-white/80 bg-white/84 text-accent-foreground" : "border-white/60 bg-white/54 text-muted-foreground")}>
                        {isComplete ? <Check className="size-4" /> : <span className="text-sm font-semibold">{index + 1}</span>}
                      </span>
                      <div className="grid gap-0.5">
                        <span className="text-sm font-semibold tracking-[-0.02em] text-foreground">{step.label}</span>
                        <span className="text-xs text-muted-foreground">{index === 0 ? "Setup" : index === 1 ? "Contacts" : index === 2 ? "Copy" : "Launch"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <details className="rounded-[1.6rem] border border-white/60 bg-white/40 p-4 md:hidden">
                <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">{creatorCopy.summary.title}</summary>
                <SummaryRail className="mt-4 shadow-none" starterType={starterType} selectedTemplateName={selectedPrimaryTemplate?.name ?? null} senderEmail={selectedSenderEmail} selectedContactsCount={targetContactIds.length} primarySubject={primaryStep?.subject ?? ""} followUpDelayDays={Number(primaryStep?.waitDays ?? 0)} sendWindowSummary={sendWindowSummary} dailySendLimit={dailySendLimit} sequenceCount={workflowSteps.length} checklist={checklist} onJump={jumpToStep} />
              </details>

              <div key={activeStep.id} className="campaign-creator-panel grid gap-6">
                <div className="space-y-2">
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-sidebar-muted">{activeStep.label}</p>
                  <h2 className="text-[2rem] font-semibold tracking-[-0.05em] text-foreground">{activeStep.id === "start" ? mode === "edit" ? creatorCopy.start.editTitle : creatorCopy.start.createTitle : activeStep.id === "audience" ? creatorCopy.audience.title : activeStep.id === "message" ? creatorCopy.message.title : creatorCopy.review.title}</h2>
                  <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{activeStep.id === "start" ? creatorCopy.start.description : activeStep.id === "audience" ? creatorCopy.audience.description : activeStep.id === "message" ? creatorCopy.message.description : creatorCopy.review.description}</p>
                </div>

                {activeStep.id === "start" ? (
                  <div className="grid gap-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <StarterCard active={starterType === "template"} icon={<Sparkles className="size-5" />} title={creatorCopy.start.templateTitle} description={creatorCopy.start.templateDescription} badge={selectedPrimaryTemplate?.name} disabled={!templates.some((template) => matchesTemplateIntent(template, "primary"))} onClick={() => { setStarterType("template"); openTemplateDialog("primary", 0, creatorCopy.start.templateDialogTitle, creatorCopy.start.templateDialogDescription); }} />
                      <StarterCard active={starterType === "scratch"} icon={<Mail className="size-5" />} title={creatorCopy.start.scratchTitle} description={creatorCopy.start.scratchDescription} onClick={resetPrimaryStepToScratch} />
                    </div>
                    <FieldError message={starterError ?? undefined} />
                    {starterType === "template" && selectedPrimaryTemplate ? <div className="rounded-[1.6rem] border border-white/70 bg-white/54 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="grid gap-1"><p className="text-base font-semibold text-foreground">{selectedPrimaryTemplate.name}</p><p className="text-sm text-muted-foreground">{selectedPrimaryTemplate.subject_template}</p></div><Button type="button" variant="outline" size="sm" onClick={() => openTemplateDialog("primary", 0, creatorCopy.start.templateDialogTitle, creatorCopy.start.templateDialogDescription)}>Browse templates</Button></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{getTemplateSnippet(selectedPrimaryTemplate)}</p></div> : null}
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="grid gap-2"><Label htmlFor="campaignName">{creatorCopy.start.campaignNameLabel}</Label><Input id="campaignName" placeholder={creatorCopy.start.campaignNamePlaceholder} {...form.register("campaignName")} /><FieldError message={typeof form.formState.errors.campaignName?.message === "string" ? form.formState.errors.campaignName.message : undefined} /></div>
                      <div className="grid gap-2"><Label htmlFor="gmailAccountId">{creatorCopy.start.senderLabel}</Label><LiquidSelect id="gmailAccountId" ariaLabel={creatorCopy.start.senderLabel} value={gmailAccountId} onValueChange={(value) => form.setValue("gmailAccountId", value, { shouldDirty: true, shouldValidate: true })} disabled={!hasMailbox} placeholder={creatorCopy.start.senderEmptyLabel} triggerClassName="h-12 rounded-[1.15rem]" options={gmailAccounts.map((account) => ({ value: account.id, label: account.email_address, description: "Approved sender mailbox" }))} /><FieldError message={typeof form.formState.errors.gmailAccountId?.message === "string" ? form.formState.errors.gmailAccountId.message : undefined} />{!hasMailbox ? <div className="rounded-[1.45rem] border border-white/70 bg-white/54 p-4"><p className="font-semibold text-foreground">{creatorCopy.start.senderHelperTitle}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{creatorCopy.start.senderHelperBody}</p><div className="mt-3"><Button asChild variant="outline" size="sm"><Link href="/settings/sending">{creatorCopy.start.senderHelperCta}</Link></Button></div></div> : null}</div>
                    </div>
                  </div>
                ) : null}
                {activeStep.id === "audience" ? (
                  <div className="grid gap-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Badge variant={targetContactIds.length ? "success" : "warning"}>
                        <Users className="size-4" />
                        {creatorCopy.audience.selectedCount(targetContactIds.length)}
                      </Badge>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => form.setValue("targetContactIds", [...new Set([...form.getValues("targetContactIds"), ...filteredContacts.map((contact) => contact.id)])], { shouldDirty: true, shouldValidate: true })}>{creatorCopy.audience.selectVisible}</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue("targetContactIds", [], { shouldDirty: true, shouldValidate: true })}>{creatorCopy.audience.clearSelection}</Button>
                        <Button asChild type="button" variant="outline" size="sm"><Link href="/imports">{creatorCopy.audience.importContacts}</Link></Button>
                        <Button type="button" size="sm" onClick={() => setContactDialogOpen(true)}><Plus className="size-4" />{creatorCopy.audience.addContact}</Button>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contact-search">Search contacts</Label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="contact-search" className="pl-11" value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} placeholder={creatorCopy.audience.searchPlaceholder} />
                      </div>
                    </div>
                    <div className="solid-content grid max-h-[34rem] gap-2 overflow-auto rounded-[1.75rem] p-4">
                      {filteredContacts.length ? filteredContacts.map((contact) => <label key={contact.id} className={cn("flex items-start gap-3 rounded-[1.25rem] border px-3 py-3 text-sm transition", targetContactIds.includes(contact.id) ? "border-white/75 bg-[rgba(215,237,247,0.52)]" : "border-transparent hover:border-white/65 hover:bg-white/56")}><input type="checkbox" value={contact.id} checked={targetContactIds.includes(contact.id)} onChange={(event) => { const current = form.getValues("targetContactIds"); form.setValue("targetContactIds", event.target.checked ? [...current, contact.id] : current.filter((value) => value !== contact.id), { shouldDirty: true, shouldValidate: true }); }} /><span className="grid min-w-0 gap-1"><span className="font-medium text-foreground">{contact.email}</span><span className="text-xs text-muted-foreground">{[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "No name"}{contact.company ? ` · ${contact.company}` : ""}</span>{(contact.tags ?? []).length ? <span className="flex flex-wrap gap-2">{(contact.tags ?? []).slice(0, 3).map((tag) => <Badge key={tag.id} variant="neutral">{tag.name}</Badge>)}</span> : null}</span></label>) : <div className="rounded-[1.5rem] border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">{availableContacts.length ? creatorCopy.audience.noMatches : creatorCopy.audience.empty}</div>}
                    </div>
                    <FieldError message={typeof form.formState.errors.targetContactIds?.message === "string" ? form.formState.errors.targetContactIds.message : undefined} />
                  </div>
                ) : null}
                {activeStep.id === "message" ? (
                  <div className="grid gap-5">
                    <CampaignMessageCard form={form} index={0} label={creatorCopy.message.primaryLabel} description={creatorCopy.message.primaryDescription} previewContact={previewContact} sendDelayLabel={creatorCopy.message.sendImmediately} templateName={selectedPrimaryTemplate?.name ?? null} onOpenTemplateChooser={() => openTemplateDialog("primary", 0, "Choose the first email template", "Pick the opening email that should preload Email 1. You can still edit every line before launch.")} />
                    <CampaignMessageCard form={form} index={1} label={creatorCopy.message.followUpLabel} description={creatorCopy.message.followUpDescription} previewContact={previewContact} sendDelayLabel={creatorCopy.message.sendAfter(Number(primaryStep?.waitDays ?? 0))} templateName={selectedFollowUpTemplate?.name ?? null} onOpenTemplateChooser={() => openTemplateDialog("follow-up", 1, "Choose the follow-up template", "Pick the follow-up email that should send after the opener. This list only shows follow-up templates.")} />
                    <div className="rounded-[1.75rem] border border-white/65 bg-white/44 p-5">
                      <button type="button" onClick={() => setAdvancedOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="neutral"><WandSparkles className="size-4" />{creatorCopy.message.advancedLabel}</Badge>
                            <Badge variant="neutral">{creatorCopy.message.advancedLimit}</Badge>
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">{creatorCopy.message.advancedDescription}</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm">{advancedOpen ? "Hide" : "Show"}</Button>
                      </button>
                      {advancedOpen ? <div className="mt-5 grid gap-4">{stepFields.fields.map((field, index) => { const step = typedWorkflowSteps[index]; return <div key={field.id} className="relative pl-7">{index < stepFields.fields.length - 1 ? <span className="absolute left-[11px] top-8 h-[calc(100%-1rem)] w-px bg-white/70" /> : null}<span className="absolute left-0 top-6 flex size-6 items-center justify-center rounded-full border border-white/72 bg-white/84 text-[11px] font-semibold text-accent-foreground">{index + 1}</span><div className="rounded-[1.5rem] border border-white/65 bg-white/58 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1"><p className="text-base font-semibold text-foreground">{step?.name || `Step ${index + 1}`}</p><p className="text-sm leading-6 text-muted-foreground">{describeWorkflowRoute(step)}</p></div>{index >= 2 ? <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveStep(index)}>Remove</Button> : null}</div><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="grid gap-2 md:col-span-2"><Label htmlFor={`advanced-step-${index}-name`}>{creatorCopy.message.routeNameLabel}</Label><Input id={`advanced-step-${index}-name`} {...form.register(`workflowDefinition.steps.${index}.name` as never)} /></div><div className="grid gap-2"><Label htmlFor={`advanced-step-${index}-wait`}>{creatorCopy.message.routeDelayLabel}</Label><Input id={`advanced-step-${index}-wait`} type="number" min={0} max={30} {...form.register(`workflowDefinition.steps.${index}.waitDays` as never)} /></div><div className="grid gap-2"><Label htmlFor={`advanced-step-${index}-branch`}>{creatorCopy.message.routeBranchLabel}</Label><LiquidSelect id={`advanced-step-${index}-branch`} ariaLabel={creatorCopy.message.routeBranchLabel} value={step?.branchCondition ?? "time"} onValueChange={(value) => form.setValue(`workflowDefinition.steps.${index}.branchCondition` as never, value as never, { shouldDirty: true, shouldValidate: true })} triggerClassName="h-12 rounded-[1.15rem]" options={[{ value: "time", label: creatorCopy.message.timeLabel, description: "Send after the wait period" }, { value: "opened", label: creatorCopy.message.openedLabel, description: "Only continue if they opened" }, { value: "clicked", label: creatorCopy.message.clickedLabel, description: "Only continue if they clicked" }]} /></div></div><div className="mt-4 grid gap-4 md:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`advanced-step-${index}-match`}>{creatorCopy.message.routeMatchLabel}</Label><LiquidSelect id={`advanced-step-${index}-match`} ariaLabel={creatorCopy.message.routeMatchLabel} value={step?.onMatch ?? "next_step"} onValueChange={(value) => form.setValue(`workflowDefinition.steps.${index}.onMatch` as never, value as never, { shouldDirty: true, shouldValidate: true })} triggerClassName="h-12 rounded-[1.15rem]" options={[{ value: "next_step", label: creatorCopy.message.nextStepLabel, description: "Keep the sequence moving" }, { value: "exit_sequence", label: creatorCopy.message.exitLabel, description: "Stop this contact here" }]} /></div><div className="grid gap-2"><Label htmlFor={`advanced-step-${index}-no-match`}>{creatorCopy.message.routeNoMatchLabel}</Label><LiquidSelect id={`advanced-step-${index}-no-match`} ariaLabel={creatorCopy.message.routeNoMatchLabel} value={step?.onNoMatch ?? "next_step"} onValueChange={(value) => form.setValue(`workflowDefinition.steps.${index}.onNoMatch` as never, value as never, { shouldDirty: true, shouldValidate: true })} triggerClassName="h-12 rounded-[1.15rem]" options={[{ value: "next_step", label: creatorCopy.message.nextStepLabel, description: "Keep the sequence moving" }, { value: "exit_sequence", label: creatorCopy.message.exitLabel, description: "Stop this contact here" }]} /></div></div>{index < 2 ? <div className="mt-4 rounded-[1.35rem] border border-white/60 bg-white/52 px-4 py-3 text-sm text-muted-foreground">Message content for this step stays in the main editor above.</div> : <div className="mt-4 grid gap-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-foreground">{creatorCopy.message.advancedExtraStepHelper}</p><Button type="button" variant="ghost" size="sm" onClick={() => form.setValue(`workflowDefinition.steps.${index}.mode` as never, ((step?.mode ?? "text") === "html" ? "text" : "html") as never, { shouldDirty: true, shouldValidate: true })}>{(step?.mode ?? "text") === "html" ? creatorCopy.message.switchToText : creatorCopy.message.switchToHtml}</Button></div><div className="grid gap-2"><Label htmlFor={`advanced-step-${index}-subject`}>{creatorCopy.message.subjectLabel}</Label><Input id={`advanced-step-${index}-subject`} {...form.register(`workflowDefinition.steps.${index}.subject` as never)} /></div>{(step?.mode ?? "text") === "html" ? <div className="grid gap-2"><Label htmlFor={`advanced-step-${index}-html`}>{creatorCopy.message.htmlBodyLabel}</Label><Textarea id={`advanced-step-${index}-html`} className="min-h-48 font-mono text-xs" {...form.register(`workflowDefinition.steps.${index}.bodyHtml` as never)} /></div> : <div className="grid gap-2"><Label htmlFor={`advanced-step-${index}-body`}>{creatorCopy.message.bodyLabel}</Label><Textarea id={`advanced-step-${index}-body`} className="min-h-48" {...form.register(`workflowDefinition.steps.${index}.body` as never)} /></div>}</div>}</div></div>; })}<div className="flex justify-end"><Button type="button" variant="outline" onClick={handleAddStep} disabled={stepFields.fields.length >= 5}><Plus className="size-4" />{creatorCopy.message.advancedAddStep}</Button></div></div> : null}
                    </div>
                  </div>
                ) : null}
                {activeStep.id === "review" ? (
                  <div className="grid gap-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="grid gap-4 rounded-[1.75rem] border border-white/65 bg-white/52 p-5">
                        <div className="space-y-1">
                          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-sidebar-muted">{creatorCopy.review.sectionTitle}</p>
                          <p className="text-base font-semibold text-foreground">{creatorCopy.review.description}</p>
                        </div>
                        <div className="grid gap-3">
                          {[
                            [creatorCopy.review.senderLabel, selectedSenderEmail ?? creatorCopy.summary.noSender],
                            [creatorCopy.review.audienceLabel, `${targetContactIds.length} contacts`],
                            [creatorCopy.review.sequenceLabel, creatorCopy.review.sequenceSummary(workflowSteps.length)],
                            [creatorCopy.review.scheduleLabel, sendWindowSummary],
                            [creatorCopy.review.dailyCapLabel, `${dailySendLimit} emails / day`],
                          ].map(([label, value]) => <div key={String(label)} className="flex items-start justify-between gap-3"><span className="text-sm text-muted-foreground">{label}</span><span className="text-sm font-medium text-foreground">{value}</span></div>)}
                        </div>
                      </div>
                      <div className="grid gap-4 rounded-[1.75rem] border border-white/65 bg-white/52 p-5">
                        <div className="grid gap-2"><Label htmlFor="timezone">{creatorCopy.review.timezoneLabel}</Label><Input id="timezone" list={timezoneListId} placeholder={creatorCopy.review.timezonePlaceholder} {...form.register("timezone")} /><datalist id={timezoneListId}>{[...new Set([timezone, ...commonTimezoneOptions].filter(Boolean))].map((option) => <option key={option} value={option} />)}</datalist><FieldError message={typeof form.formState.errors.timezone?.message === "string" ? form.formState.errors.timezone.message : undefined} /></div>
                        <div className="grid gap-2"><Label>{creatorCopy.review.presetLabel}</Label><div className="flex flex-wrap gap-2">{sendWindowPresets.map((preset) => <Button key={preset.id} type="button" size="sm" variant={sendWindowPresetId === preset.id ? "secondary" : "outline"} onClick={() => setSendWindowPreset(preset.id)}>{preset.label}</Button>)}</div></div>
                        <div className="grid gap-4 md:grid-cols-2"><div className="grid gap-2"><Label htmlFor="sendWindowStart">{creatorCopy.review.sendWindowLabel}</Label><Input id="sendWindowStart" type="time" {...form.register("sendWindowStart")} /></div><div className="grid gap-2"><Label htmlFor="sendWindowEnd">{creatorCopy.review.customLabel}</Label><Input id="sendWindowEnd" type="time" {...form.register("sendWindowEnd")} /></div></div>
                        <div className="grid gap-2"><Label htmlFor="dailySendLimit">{creatorCopy.review.dailyCapLabel}</Label><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={() => adjustDailyCap(-5)}>-5</Button><Input id="dailySendLimit" type="number" min={1} max={500} {...form.register("dailySendLimit")} /><Button type="button" variant="outline" size="sm" onClick={() => adjustDailyCap(5)}>+5</Button></div></div>
                      </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-[1.75rem] border border-white/65 bg-white/52 p-5"><div className="flex items-center gap-2"><Mail className="size-4 text-accent-foreground" /><p className="font-semibold text-foreground">{creatorCopy.review.sequenceLabel}</p></div><div className="mt-4 grid gap-3">{workflowSteps.map((step, index) => <div key={`${step?.name ?? "step"}-${index}`} className="rounded-[1.35rem] border border-white/60 bg-white/46 px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-foreground">{step?.name || `Step ${index + 1}`}</p><Badge variant="neutral">{index === 0 ? creatorCopy.message.sendImmediately : creatorCopy.message.sendAfter(Number(workflowSteps[index - 1]?.waitDays ?? 0))}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{step?.subject || creatorCopy.summary.noSubject}</p></div>)}</div></div>
                      <div className="rounded-[1.75rem] border border-white/65 bg-white/52 p-5"><div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-accent-foreground" /><p className="font-semibold text-foreground">{creatorCopy.review.checklistTitle}</p></div><div className="mt-4 grid gap-3">{checklist.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-[1.25rem] border border-white/60 bg-white/46 px-4 py-3"><span className={cn("flex size-8 items-center justify-center rounded-full border", item.complete ? "border-white/72 bg-[rgba(215,237,247,0.86)] text-accent-foreground" : "border-white/72 bg-white/60 text-muted-foreground")}>{item.complete ? <Check className="size-4" /> : <ChevronRight className="size-4" />}</span><span className={cn("text-sm", item.complete ? "text-foreground" : "text-muted-foreground")}>{item.label}</span></div>)}</div></div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="hidden items-center justify-between gap-3 md:flex">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4" /><span>{activeStep.id === "review" ? "Final review before launch." : "Progress stays in the form until you launch."}</span></div>
                <div className="flex flex-wrap justify-end gap-3">
                  {currentStepIndex > 0 ? <Button type="button" variant="outline" onClick={goToPreviousStep}><ArrowLeft className="size-4" />{creatorCopy.nav.back}</Button> : null}
                  {activeStep.id !== "review" ? <Button type="button" onClick={() => void goToNextStep()}>{creatorCopy.nav.continue}<ArrowRight className="size-4" /></Button> : <>{mode === "create" ? <Button type="button" variant="outline" disabled={isPending || !reviewReady} onClick={() => void submitCampaign(true)}>{creatorCopy.review.launchNowLabel}</Button> : null}<Button type="button" disabled={isPending || !reviewReady} onClick={() => void submitCampaign(false)}>{mode === "edit" ? creatorCopy.review.saveChangesLabel : creatorCopy.review.launchLabel}</Button></>}
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="sticky bottom-4 z-20 md:hidden">
            <div className="glass-control flex items-center justify-between gap-3 rounded-[1.6rem] p-3 shadow-[0_24px_44px_rgba(17,39,63,0.16)]">
              <Button type="button" variant="outline" size="sm" onClick={goToPreviousStep} disabled={currentStepIndex === 0}><ArrowLeft className="size-4" />{creatorCopy.nav.back}</Button>
              {activeStep.id !== "review" ? <Button type="button" size="sm" onClick={() => void goToNextStep()}>{creatorCopy.nav.continue}<ArrowRight className="size-4" /></Button> : <Button type="button" size="sm" disabled={isPending || !reviewReady} onClick={() => void submitCampaign(false)}>{mode === "edit" ? creatorCopy.review.saveChangesLabel : creatorCopy.review.launchLabel}</Button>}
            </div>
          </div>
        </div>
        <SummaryRail className="sticky top-6 hidden h-fit xl:block" starterType={starterType} selectedTemplateName={selectedPrimaryTemplate?.name ?? null} senderEmail={selectedSenderEmail} selectedContactsCount={targetContactIds.length} primarySubject={primaryStep?.subject ?? ""} followUpDelayDays={Number(primaryStep?.waitDays ?? 0)} sendWindowSummary={sendWindowSummary} dailySendLimit={dailySendLimit} sequenceCount={workflowSteps.length} checklist={checklist} onJump={jumpToStep} />
      </form>
    </>
  );
}
