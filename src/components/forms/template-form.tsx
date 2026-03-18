"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
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

const DEFAULT_TEMPLATE_VALUES: z.input<typeof templateSchema> = {
  name: "",
  subjectTemplate: "Quick idea for {{company}}",
  mode: "text",
  bodyTemplate:
    "Hi {{first_name}},\n\nNoticed {{company}} and thought a short intro might be useful.\n\nBest,\nJay",
  bodyHtmlTemplate: "",
};

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

  return "Failed to save template";
}

export function TemplateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues: DEFAULT_TEMPLATE_VALUES,
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
        bodyHtmlTemplate: mode === "html" ? bodyHtmlTemplate ?? "" : null,
        contact: { first_name: "Alina", company: "Northstar", website: "northstar.dev" },
      }),
    [bodyHtmlTemplate, bodyTemplate, mode, subjectTemplate],
  );
  const nameError = form.formState.errors.name?.message;
  const subjectError = form.formState.errors.subjectTemplate?.message;
  const bodyError = form.formState.errors.bodyTemplate?.message;
  const bodyHtmlError = form.formState.errors.bodyHtmlTemplate?.message;

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const normalizedValues =
        values.mode === "html"
          ? {
              ...values,
              bodyTemplate:
                values.bodyTemplate?.trim() && values.bodyTemplate.trim().length >= 10
                  ? values.bodyTemplate
                  : stripHtmlToText(values.bodyHtmlTemplate ?? ""),
            }
          : values;
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

      form.reset(DEFAULT_TEMPLATE_VALUES);
      router.refresh();
      toast.success("Template saved");
    });
  });

  return (
    <Card className="border-border/60 bg-card/90">
      <CardHeader>
        <CardTitle>Create template</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="name">Template name</Label>
            <Input id="name" {...form.register("name")} />
            {nameError ? <p className="text-sm text-danger">{nameError}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="subjectTemplate">Subject</Label>
            <Input id="subjectTemplate" {...form.register("subjectTemplate")} />
            {subjectError ? <p className="text-sm text-danger">{subjectError}</p> : null}
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Template mode</Label>
              <Badge variant="neutral">{mode === "html" ? "HTML template" : "Text template"}</Badge>
            </div>
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
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="html">HTML</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {mode === "html" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="bodyHtmlTemplate">HTML body</Label>
                <Textarea
                  id="bodyHtmlTemplate"
                  className="min-h-60 font-mono text-xs"
                  {...form.register("bodyHtmlTemplate")}
                />
                {bodyHtmlError ? <p className="text-sm text-danger">{bodyHtmlError}</p> : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="template-html-file">Import HTML file</Label>
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
                <Label htmlFor="bodyTemplate">Text fallback</Label>
                <Textarea
                  id="bodyTemplate"
                  className="min-h-36"
                  placeholder="Optional plain-text fallback. Leave blank to auto-generate."
                  {...form.register("bodyTemplate")}
                />
                {bodyError ? <p className="text-sm text-danger">{bodyError}</p> : null}
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="bodyTemplate">Body</Label>
              <Textarea id="bodyTemplate" className="min-h-60" {...form.register("bodyTemplate")} />
              {bodyError ? <p className="text-sm text-danger">{bodyError}</p> : null}
            </div>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save template"}
          </Button>
        </form>
        <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
          <Tabs defaultValue="rendered" className="grid gap-4">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="rendered">Preview</TabsTrigger>
              <TabsTrigger value="text">Text</TabsTrigger>
            </TabsList>
            <TabsContent value="rendered" className="mt-0">
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Subject
                </p>
                <p className="text-lg font-semibold">{preview.subject || "No subject yet"}</p>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Body
                </p>
                {mode === "html" && preview.bodyHtml ? (
                  <div className="overflow-hidden rounded-3xl border border-border/60 bg-white p-4 text-sm leading-6 text-slate-700">
                    <SafeHtmlContent html={preview.bodyHtml} />
                  </div>
                ) : (
                  <div className="rounded-3xl border border-border/60 bg-background/80 p-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {preview.body || "No body yet"}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="text" className="mt-0">
              <div className="rounded-3xl border border-border/60 bg-background/80 p-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {preview.textFallback || "No text preview yet"}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}
