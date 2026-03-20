"use client";

import { useMemo } from "react";
import { Eye } from "lucide-react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { previewRenderedTemplate } from "@/lib/utils/template";
import type { CampaignFormValues } from "@/lib/campaigns/wizard-defaults";
import { creatorCopy } from "@/components/campaigns/campaign-creator-copy";
import { FieldError } from "@/components/campaigns/campaign-creator-shared";
import { SafeHtmlContent } from "@/components/shared/safe-html-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type PreviewContact = {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  website?: string | null;
  job_title?: string | null;
  custom?: Record<string, string | number | boolean | null | undefined> | null;
};

function getStepFieldError(
  form: UseFormReturn<CampaignFormValues>,
  index: number,
  field: "subject" | "body" | "bodyHtml",
) {
  const stepError = form.formState.errors.workflowDefinition?.steps?.[index];
  const message = stepError?.[field]?.message;
  return typeof message === "string" ? message : undefined;
}

export function CampaignMessageCard({
  form,
  index,
  label,
  description,
  previewContact,
  sendDelayLabel,
  templateName,
  onOpenTemplateChooser,
}: {
  form: UseFormReturn<CampaignFormValues>;
  index: number;
  label: string;
  description: string;
  previewContact: PreviewContact;
  sendDelayLabel: string;
  templateName?: string | null;
  onOpenTemplateChooser?: () => void;
}) {
  const step = useWatch({
    control: form.control,
    name: `workflowDefinition.steps.${index}` as never,
  }) as CampaignFormValues["workflowDefinition"]["steps"][number] | undefined;
  const mode = step?.mode ?? "text";
  const preview = useMemo(
    () =>
      previewRenderedTemplate({
        subjectTemplate: step?.subject ?? "",
        bodyTemplate: step?.body ?? "",
        bodyHtmlTemplate: mode === "html" ? step?.bodyHtml ?? "" : null,
        contact: previewContact,
      }),
    [mode, previewContact, step?.body, step?.bodyHtml, step?.subject],
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-white/56 bg-white/28">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">{label}</Badge>
              <Badge variant="neutral">{sendDelayLabel}</Badge>
              <Badge variant={mode === "html" ? "warning" : "neutral"}>
                {mode === "html" ? "Designed email" : "Plain text"}
              </Badge>
            </div>
            <div className="space-y-1">
              <CardTitle className="text-[1.4rem] tracking-[-0.04em]">{label}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          {onOpenTemplateChooser ? (
            <div className="grid justify-items-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onOpenTemplateChooser}>
                {creatorCopy.message.changeTemplate}
              </Button>
              <p className="text-xs text-muted-foreground">
                {templateName ?? creatorCopy.summary.noTemplateSelected}
              </p>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 p-5 sm:p-6">
        <Tabs defaultValue="write" className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="w-fit">
              <TabsTrigger value="write">{creatorCopy.message.writeTab}</TabsTrigger>
              <TabsTrigger value="preview">
                <Eye className="size-4" />
                {creatorCopy.message.previewTab}
              </TabsTrigger>
            </TabsList>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                form.setValue(
                  `workflowDefinition.steps.${index}.mode` as never,
                  (mode === "html" ? "text" : "html") as never,
                  { shouldDirty: true, shouldValidate: true },
                )
              }
            >
              {mode === "html"
                ? creatorCopy.message.switchToText
                : creatorCopy.message.switchToHtml}
            </Button>
          </div>

          <TabsContent value="write" className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`workflow-step-${index}-subject`}>
                {creatorCopy.message.subjectLabel}
              </Label>
              <Input
                id={`workflow-step-${index}-subject`}
                {...form.register(`workflowDefinition.steps.${index}.subject` as never)}
              />
              <FieldError message={getStepFieldError(form, index, "subject")} />
            </div>

            {mode === "html" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor={`workflow-step-${index}-html`}>
                    {creatorCopy.message.htmlBodyLabel}
                  </Label>
                  <Textarea
                    id={`workflow-step-${index}-html`}
                    className="min-h-72 font-mono text-xs"
                    {...form.register(`workflowDefinition.steps.${index}.bodyHtml` as never)}
                  />
                  <FieldError message={getStepFieldError(form, index, "bodyHtml")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`workflow-step-${index}-file`}>
                    {creatorCopy.message.importHtmlLabel}
                  </Label>
                  <Input
                    id={`workflow-step-${index}-file`}
                    type="file"
                    accept=".html,.htm,text/html"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        return;
                      }

                      void file.text().then((value) => {
                        form.setValue(`workflowDefinition.steps.${index}.mode` as never, "html" as never, {
                          shouldDirty: true,
                        });
                        form.setValue(`workflowDefinition.steps.${index}.bodyHtml` as never, value as never, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      });
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`workflow-step-${index}-fallback`}>
                    {creatorCopy.message.fallbackLabel}
                  </Label>
                  <Textarea
                    id={`workflow-step-${index}-fallback`}
                    className="min-h-40"
                    placeholder={creatorCopy.message.fallbackPlaceholder}
                    {...form.register(`workflowDefinition.steps.${index}.body` as never)}
                  />
                  <FieldError message={getStepFieldError(form, index, "body")} />
                </div>
              </>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor={`workflow-step-${index}-body`}>
                  {creatorCopy.message.bodyLabel}
                </Label>
                <Textarea
                  id={`workflow-step-${index}-body`}
                  className="min-h-72"
                  {...form.register(`workflowDefinition.steps.${index}.body` as never)}
                />
                <FieldError message={getStepFieldError(form, index, "body")} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="grid gap-4">
            <div className="grid gap-1">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {creatorCopy.message.previewSubjectLabel}
              </p>
              <p className="text-base font-semibold text-foreground">
                {preview.subject || "No subject yet"}
              </p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {creatorCopy.message.previewBodyLabel}
              </p>
              {mode === "html" && preview.bodyHtml ? (
                <div className="overflow-hidden rounded-[1.5rem] border border-white/65 bg-white p-4 text-sm leading-6 text-slate-700">
                  <SafeHtmlContent html={preview.bodyHtml} />
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-white/60 bg-white/54 p-4 text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
                  {preview.body || "No message body yet"}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
