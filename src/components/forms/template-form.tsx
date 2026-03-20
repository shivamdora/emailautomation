"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { productContent } from "@/content/product";
import { stripHtmlToText } from "@/lib/utils/html";
import { previewRenderedTemplate } from "@/lib/utils/template";
import { templateSchema } from "@/lib/zod/schemas";
import { SafeHtmlContent } from "@/components/shared/safe-html-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

function buildDefaultTemplateValues(mode: "text" | "html"): z.input<typeof templateSchema> {
  return {
    name: "",
    subjectTemplate: mode === "html" ? "Worth a quick 15-minute chat for {{company}}?" : "Quick idea for {{company}}",
    mode,
    bodyTemplate:
      mode === "html"
        ? ""
        : "Hi {{first_name}},\n\nNoticed {{company}} and thought a short intro might be useful.\n\nBest,\nJay",
    bodyHtmlTemplate: "",
  };
}

function getApiErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "fieldErrors" in error &&
    typeof error.fieldErrors === "object" &&
    error.fieldErrors
  ) {
    const fieldErrors = error.fieldErrors as Record<string, unknown>;
    const fieldLabels: Record<string, string> = {
      name: "Template name",
      subjectTemplate: "Subject",
      bodyTemplate: "Text body",
      bodyHtmlTemplate: "HTML body",
    };

    for (const [key, value] of Object.entries(fieldErrors)) {
      const firstMessage = (Array.isArray(value) ? value : []).find((entry) => typeof entry === "string");
      if (typeof firstMessage === "string") {
        return `${fieldLabels[key] ?? key}: ${firstMessage}`;
      }
    }
  }

  if (
    error &&
    typeof error === "object" &&
    "formErrors" in error &&
    Array.isArray(error.formErrors)
  ) {
    const firstMessage = error.formErrors.find((entry) => typeof entry === "string");
    if (typeof firstMessage === "string") {
      return firstMessage;
    }
  }

  return productContent.templates.form.errorMessage;
}

export function TemplateForm({
  initialMode = "text",
  allowHtml = true,
  onCancel,
  onSaved,
  title,
}: {
  initialMode?: "text" | "html";
  allowHtml?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
  title?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formCopy = productContent.templates.form;
  const resolvedInitialMode = allowHtml ? initialMode : "text";
  const defaultValues = buildDefaultTemplateValues(resolvedInitialMode);
  const form = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues,
  });
  const mode = useWatch({
    control: form.control,
    name: "mode",
  });
  const subjectTemplate = useWatch({
    control: form.control,
    name: "subjectTemplate",
  });
  const bodyTemplate = useWatch({
    control: form.control,
    name: "bodyTemplate",
  });
  const bodyHtmlTemplate = useWatch({
    control: form.control,
    name: "bodyHtmlTemplate",
  });
  const preview = useMemo(
    () =>
      previewRenderedTemplate({
        subjectTemplate: subjectTemplate ?? "",
        bodyTemplate: bodyTemplate ?? "",
        bodyHtmlTemplate: allowHtml && mode === "html" ? bodyHtmlTemplate ?? "" : null,
        contact: { first_name: "Alina", company: "Northstar", website: "northstar.dev" },
      }),
    [allowHtml, bodyHtmlTemplate, bodyTemplate, mode, subjectTemplate],
  );
  const nameError = form.formState.errors.name?.message;
  const subjectError = form.formState.errors.subjectTemplate?.message;
  const bodyError = form.formState.errors.bodyTemplate?.message;
  const bodyHtmlError = form.formState.errors.bodyHtmlTemplate?.message;

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const preparedValues = allowHtml
        ? values
        : {
            ...values,
            mode: "text" as const,
            bodyHtmlTemplate: "",
          };
      const normalizedValues =
        preparedValues.mode === "html"
          ? {
              ...preparedValues,
              bodyTemplate:
                preparedValues.bodyTemplate?.trim() && preparedValues.bodyTemplate.trim().length >= 10
                  ? preparedValues.bodyTemplate
                  : stripHtmlToText(preparedValues.bodyHtmlTemplate ?? ""),
            }
          : preparedValues;
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalizedValues),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        toast.error(getApiErrorMessage(error?.error));
        return;
      }

      form.reset(defaultValues);
      router.refresh();
      toast.success(formCopy.successMessage);
      onSaved?.();
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title ?? formCopy.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="name">{formCopy.nameLabel}</Label>
            <Input id="name" {...form.register("name")} />
            {nameError ? <p className="text-sm text-danger">{nameError}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="subjectTemplate">{formCopy.subjectLabel}</Label>
            <Input id="subjectTemplate" {...form.register("subjectTemplate")} />
            {subjectError ? <p className="text-sm text-danger">{subjectError}</p> : null}
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label>{formCopy.modeLabel}</Label>
              <Badge variant="neutral">
                {allowHtml && mode === "html" ? formCopy.htmlTemplateBadge : formCopy.textTemplateBadge}
              </Badge>
            </div>
            {allowHtml ? (
              <Tabs
                value={mode ?? "text"}
                onValueChange={(value) =>
                  form.setValue("mode", value as "text" | "html", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <TabsList>
                  <TabsTrigger value="text">{productContent.shared.textTab}</TabsTrigger>
                  <TabsTrigger value="html">{productContent.templates.table.htmlModeLabel}</TabsTrigger>
                </TabsList>
              </Tabs>
            ) : (
              <div className="rounded-[1.15rem] border border-white/60 bg-white/60 px-4 py-3 text-sm text-muted-foreground">
                Text templates only on this page. HTML templates remain available inside campaign steps.
              </div>
            )}
          </div>
          {allowHtml && mode === "html" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="bodyHtmlTemplate">{formCopy.htmlBodyLabel}</Label>
                <Textarea
                  id="bodyHtmlTemplate"
                  className="min-h-60 font-mono text-xs"
                  {...form.register("bodyHtmlTemplate")}
                />
                {bodyHtmlError ? <p className="text-sm text-danger">{bodyHtmlError}</p> : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="template-html-file">{formCopy.importHtmlLabel}</Label>
                <Input
                  id="template-html-file"
                  type="file"
                  accept=".html,.htm,text/html"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }

                    void file.text().then((value) => {
                      form.setValue("mode", "html", { shouldDirty: true, shouldValidate: true });
                      form.setValue("bodyHtmlTemplate", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    });
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bodyTemplate">{formCopy.fallbackLabel}</Label>
                <Textarea
                  id="bodyTemplate"
                  className="min-h-36"
                  placeholder={formCopy.fallbackPlaceholder}
                  {...form.register("bodyTemplate")}
                />
                {bodyError ? <p className="text-sm text-danger">{bodyError}</p> : null}
              </div>
            </>
          ) : (
            <div className="grid gap-2">
                <Label htmlFor="bodyTemplate">{formCopy.bodyLabel}</Label>
                <Textarea id="bodyTemplate" className="min-h-60" {...form.register("bodyTemplate")} />
              {bodyError ? <p className="text-sm text-danger">{bodyError}</p> : null}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit" disabled={isPending}>
              {isPending ? formCopy.savingLabel : formCopy.saveLabel}
            </Button>
          </div>
        </form>
        <div className="glass-control rounded-[28px] p-5">
          <Tabs defaultValue="rendered" className="grid gap-4">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="rendered">{productContent.shared.previewTab}</TabsTrigger>
              <TabsTrigger value="text">{productContent.shared.textTab}</TabsTrigger>
            </TabsList>
            <TabsContent value="rendered" className="mt-0">
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {formCopy.previewSubjectLabel}
                </p>
                <p className="text-lg font-semibold">{preview.subject || productContent.shared.noSubjectLabel}</p>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {formCopy.previewBodyLabel}
                </p>
                {allowHtml && mode === "html" && preview.bodyHtml ? (
                  <div className="overflow-hidden rounded-[1.5rem] border border-white/65 bg-white p-4 text-sm leading-6 text-slate-700">
                    <SafeHtmlContent html={preview.bodyHtml} />
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-white/60 bg-white/54 p-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {preview.body || productContent.shared.noBodyLabel}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="text" className="mt-0">
              <div className="rounded-[1.5rem] border border-white/60 bg-white/54 p-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {preview.textFallback || productContent.shared.noTextPreviewLabel}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}
