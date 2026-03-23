"use client";

import { useMemo, useRef, useState, useTransition, type ComponentType, type ReactNode } from "react";
import {
  Bold,
  ChevronDown,
  Eye,
  Heading1,
  Italic,
  Link2,
  List,
  Minus,
  Monitor,
  MousePointerClick,
  Pilcrow,
  Quote,
  Rows3,
  Smartphone,
  TextAlignCenter,
  TextAlignStart,
  Type,
  Underline,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { productContent } from "@/content/product";
import { cn } from "@/lib/utils";
import { stripHtmlToText } from "@/lib/utils/html";
import {
  applyTemplateToolbarAction,
  convertPlainTextTemplateToHtml,
  detectTemplateComposerMode,
  normalizeTemplateComposerInput,
  previewRenderedTemplate,
  TEMPLATE_BODY_TOKENS,
  type TemplateComposerMode,
  type TemplateToolbarAction,
} from "@/lib/utils/template";
import { templateSchema } from "@/lib/zod/schemas";
import { EmailPreviewFrame } from "@/components/templates/email-preview-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type PreviewViewport = "desktop" | "mobile";

const TEXT_STYLE_ACTIONS: Array<{
  action: Extract<TemplateToolbarAction, "paragraph" | "heading">;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { action: "paragraph", label: "Paragraph", icon: Pilcrow },
  { action: "heading", label: "Heading", icon: Heading1 },
];

const TOOLBAR_GROUPS: Array<
  Array<{
    action: Exclude<TemplateToolbarAction, "paragraph" | "heading">;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }>
> = [
  [
    { action: "bold", label: "Bold", icon: Bold },
    { action: "italic", label: "Italic", icon: Italic },
    { action: "underline", label: "Underline", icon: Underline },
  ],
  [
    { action: "bullet-list", label: "Bulleted list", icon: List },
    { action: "quote", label: "Quote", icon: Quote },
    { action: "align-left", label: "Align left", icon: TextAlignStart },
    { action: "align-center", label: "Align center", icon: TextAlignCenter },
  ],
  [
    { action: "link", label: "Link", icon: Link2 },
    { action: "button", label: "CTA button", icon: MousePointerClick },
    { action: "divider", label: "Divider", icon: Minus },
    { action: "spacer", label: "Spacer", icon: Rows3 },
  ],
];

function ToolbarIconButton({
  label,
  active = false,
  children,
  onClick,
}: {
  label: string;
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-[0.95rem] border border-transparent text-muted-foreground transition-[background-color,border-color,color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
            active
              ? "border-white/86 bg-white/92 text-foreground shadow-[0_12px_24px_rgba(17,39,63,0.08)]"
              : "hover:border-white/72 hover:bg-white/72 hover:text-foreground",
          )}
        >
          {children}
          <span className="sr-only">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function buildDefaultTemplateValues(mode: "text" | "html"): z.input<typeof templateSchema> {
  return {
    name: "",
    subjectTemplate:
      mode === "html" ? "Worth a quick 15-minute chat for {{company}}?" : "Quick idea for {{company}}",
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
      bodyTemplate: "Body",
      bodyHtmlTemplate: "Body",
    };

    for (const [key, value] of Object.entries(fieldErrors)) {
      const firstMessage = (Array.isArray(value) ? value : []).find((entry) => typeof entry === "string");
      if (typeof firstMessage === "string") {
        return `${fieldLabels[key] ?? key}: ${firstMessage}`;
      }
    }
  }

  if (error && typeof error === "object" && "formErrors" in error && Array.isArray(error.formErrors)) {
    const firstMessage = error.formErrors.find((entry) => typeof entry === "string");
    if (typeof firstMessage === "string") {
      return firstMessage;
    }
  }

  return productContent.templates.form.errorMessage;
}

function resolveModeBadgeLabel(
  formCopy: typeof productContent.templates.form,
  mode: TemplateComposerMode,
  isAutoDetectedHtml: boolean,
) {
  if (mode === "html") {
    return isAutoDetectedHtml ? formCopy.autoDetectedBadge : formCopy.htmlTemplateBadge;
  }

  return formCopy.textTemplateBadge;
}

function TemplatePreviewBody({
  mode,
  html,
  text,
  viewport = "desktop",
  compact = false,
}: {
  mode: TemplateComposerMode;
  html?: string | null;
  text: string;
  viewport?: PreviewViewport;
  compact?: boolean;
}) {
  if (mode === "html" && html) {
    return (
      <div className="overflow-hidden rounded-[1.5rem] border border-white/65 bg-[linear-gradient(180deg,rgba(248,251,253,0.98),rgba(236,242,246,0.92))]">
        <div className={compact ? "p-3" : "p-4"}>
          <EmailPreviewFrame
            html={html}
            viewport={viewport}
            maxCanvasHeight={compact ? 360 : 520}
            className="rounded-[1.2rem]"
            frameClassName="overflow-hidden rounded-[1.2rem] bg-white shadow-[0_18px_40px_rgba(17,39,63,0.14)]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(248,251,254,0.86))] p-5">
      <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-white/76 px-4 py-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
        {text || productContent.shared.noBodyLabel}
      </div>
    </div>
  );
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
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>("desktop");
  const [isAutoDetectedHtml, setIsAutoDetectedHtml] = useState(false);
  const [lastToolbarAction, setLastToolbarAction] = useState<TemplateToolbarAction | null>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const formCopy = productContent.templates.form;
  const resolvedInitialMode = allowHtml ? initialMode : "text";
  const defaultValues = buildDefaultTemplateValues(resolvedInitialMode);
  const initialBody = resolvedInitialMode === "html" ? defaultValues.bodyHtmlTemplate ?? "" : defaultValues.bodyTemplate ?? "";
  const form = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues,
  });
  const [bodyValue, setBodyValue] = useState(initialBody);
  const [bodyMode, setBodyMode] = useState<TemplateComposerMode>(resolvedInitialMode);
  const subjectTemplate = useWatch({
    control: form.control,
    name: "subjectTemplate",
  });

  const composerState = useMemo(
    () => normalizeTemplateComposerInput({ bodyValue, preferredMode: bodyMode }),
    [bodyMode, bodyValue],
  );
  const preview = useMemo(
    () =>
      previewRenderedTemplate({
        subjectTemplate: subjectTemplate ?? "",
        bodyTemplate: composerState.bodyTemplate,
        bodyHtmlTemplate: bodyMode === "html" ? composerState.bodyHtmlTemplate : null,
        contact: { first_name: "Alina", company: "Northstar", website: "northstar.dev" },
      }),
    [bodyMode, composerState.bodyHtmlTemplate, composerState.bodyTemplate, subjectTemplate],
  );

  const nameError = form.formState.errors.name?.message;
  const subjectError = form.formState.errors.subjectTemplate?.message;
  const bodyError =
    bodyMode === "html" ? form.formState.errors.bodyHtmlTemplate?.message : form.formState.errors.bodyTemplate?.message;

  function syncComposer(
    nextValue: string,
    preferredMode?: TemplateComposerMode | null,
    displayValue?: string,
  ) {
    const normalized = normalizeTemplateComposerInput({ bodyValue: nextValue, preferredMode });
    setBodyValue(displayValue ?? nextValue);
    setBodyMode(normalized.mode);
    form.setValue("mode", normalized.mode, { shouldDirty: true, shouldValidate: true });
    form.setValue("bodyTemplate", normalized.bodyTemplate, { shouldDirty: true, shouldValidate: true });
    form.setValue("bodyHtmlTemplate", normalized.bodyHtmlTemplate, { shouldDirty: true, shouldValidate: true });
    return normalized;
  }

  function handleBodyChange(nextValue: string) {
    const detectedHtml = detectTemplateComposerMode(nextValue) === "html";
    syncComposer(nextValue, bodyMode === "html" ? "html" : undefined, nextValue);
    if (detectedHtml && bodyMode !== "html") {
      setIsAutoDetectedHtml(true);
    } else if (!detectedHtml && bodyMode !== "html") {
      setIsAutoDetectedHtml(false);
    }
  }

  function handleToggleMode() {
    if (bodyMode === "html") {
      syncComposer(stripHtmlToText(bodyValue), "text");
      setIsAutoDetectedHtml(false);
      return;
    }

    const htmlValue = convertPlainTextTemplateToHtml(bodyValue);
    syncComposer(htmlValue, "html", htmlValue);
    setIsAutoDetectedHtml(false);
  }

  function focusBodyAt(selectionStart: number, selectionEnd: number) {
    requestAnimationFrame(() => {
      const textarea = bodyTextareaRef.current;
      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function handleToolbarAction(action: TemplateToolbarAction) {
    const textarea = bodyTextareaRef.current;
    if (!textarea) {
      return;
    }

    const result = applyTemplateToolbarAction({
      action,
      value: bodyValue,
      selectionStart: textarea.selectionStart ?? bodyValue.length,
      selectionEnd: textarea.selectionEnd ?? bodyValue.length,
    });

    syncComposer(result.value, "html");
    setIsAutoDetectedHtml(false);
    setLastToolbarAction(action);
    focusBodyAt(result.selectionStart, result.selectionEnd);
  }

  function insertToken(token: string) {
    const textarea = bodyTextareaRef.current;
    const selectionStart = textarea?.selectionStart ?? bodyValue.length;
    const selectionEnd = textarea?.selectionEnd ?? bodyValue.length;
    const nextValue = bodyValue.slice(0, selectionStart) + token + bodyValue.slice(selectionEnd);
    handleBodyChange(nextValue);
    focusBodyAt(selectionStart + token.length, selectionStart + token.length);
  }

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const normalizedBody = normalizeTemplateComposerInput({
        bodyValue,
        preferredMode: bodyMode,
      });

      const payload = {
        ...values,
        mode: normalizedBody.mode,
        bodyTemplate: normalizedBody.bodyTemplate,
        bodyHtmlTemplate: normalizedBody.bodyHtmlTemplate,
      };

      const response = await fetch("/api/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        toast.error(getApiErrorMessage(error?.error));
        return;
      }

      form.reset(defaultValues);
      setBodyMode(resolvedInitialMode);
      setBodyValue(initialBody);
      setIsAutoDetectedHtml(false);
      setActiveTab("write");
      setPreviewViewport("desktop");
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
        <form className="grid gap-5" onSubmit={onSubmit}>
          <input type="hidden" {...form.register("mode")} />
          <input type="hidden" {...form.register("bodyTemplate")} />
          <input type="hidden" {...form.register("bodyHtmlTemplate")} />

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

          <div className="grid gap-4 rounded-[1.75rem] border border-white/65 bg-white/52 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={bodyMode === "html" ? "warning" : "neutral"}>
                  {resolveModeBadgeLabel(formCopy, bodyMode, isAutoDetectedHtml)}
                </Badge>
                <Badge variant="neutral">{formCopy.modeLabel}</Badge>
              </div>
              {allowHtml ? (
                <Button type="button" variant="ghost" size="sm" onClick={handleToggleMode}>
                  {bodyMode === "html" ? formCopy.switchToTextLabel : formCopy.switchToHtmlLabel}
                </Button>
              ) : null}
            </div>

            <p className="text-sm leading-6 text-muted-foreground">{formCopy.bodyHelper}</p>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "write" | "preview")} className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList className="w-fit">
                  <TabsTrigger value="write">{formCopy.writeTab}</TabsTrigger>
                  <TabsTrigger value="preview">
                    <Eye className="size-4" />
                    {productContent.shared.previewTab}
                  </TabsTrigger>
                </TabsList>

                {bodyMode === "html" ? (
                  <Badge variant="neutral">{formCopy.importHtmlLabel}</Badge>
                ) : null}
              </div>

              <TabsContent value="write" className="grid gap-4">
                <div className="grid gap-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {formCopy.visualToolsLabel}
                  </p>
                  <TooltipProvider delayDuration={120}>
                    <div className="scrollbar-none overflow-x-auto pb-1">
                      <div className="glass-control inline-flex min-w-max items-center gap-1 rounded-[1.3rem] border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,248,253,0.78))] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="Text style"
                                  title="Text style"
                                  className={cn(
                                    "inline-flex h-9 items-center gap-1.5 rounded-[0.95rem] border px-2.5 text-sm text-muted-foreground transition-[background-color,border-color,color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
                                    lastToolbarAction === "paragraph" || lastToolbarAction === "heading"
                                      ? "border-white/86 bg-white/92 text-foreground shadow-[0_12px_24px_rgba(17,39,63,0.08)]"
                                      : "border-transparent hover:border-white/72 hover:bg-white/72 hover:text-foreground",
                                  )}
                                >
                                  <Type className="size-4" />
                                  <ChevronDown className="size-3.5" />
                                  <span className="sr-only">Text style</span>
                                </button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Text style</TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="start" className="min-w-[11rem] p-1.5">
                            {TEXT_STYLE_ACTIONS.map((item) => (
                              <DropdownMenuItem
                                key={item.action}
                                onSelect={(event) => {
                                  event.preventDefault();
                                  handleToolbarAction(item.action);
                                }}
                              >
                                <item.icon className="size-4 text-muted-foreground" />
                                <span>{item.label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {TOOLBAR_GROUPS.map((group, groupIndex) => (
                          <div key={groupIndex} className="contents">
                            <Separator orientation="vertical" className="mx-1 h-6 bg-border/70" />
                            <div className="flex items-center gap-1">
                              {group.map((item) => (
                                <ToolbarIconButton
                                  key={item.action}
                                  label={item.label}
                                  active={lastToolbarAction === item.action}
                                  onClick={() => handleToolbarAction(item.action)}
                                >
                                  <item.icon className="size-4" />
                                </ToolbarIconButton>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TooltipProvider>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="bodyComposer">
                    {bodyMode === "html" ? formCopy.htmlBodyLabel : formCopy.bodyLabel}
                  </Label>
                  <Textarea
                    ref={bodyTextareaRef}
                    id="bodyComposer"
                    value={bodyValue}
                    onChange={(event) => handleBodyChange(event.target.value)}
                    className={cn("min-h-72", bodyMode === "html" ? "font-mono text-xs" : "text-sm")}
                    autoComplete="off"
                    spellCheck={bodyMode !== "html"}
                  />
                  {typeof bodyError === "string" ? <p className="text-sm text-danger">{bodyError}</p> : null}
                </div>

                {bodyMode === "html" ? (
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
                          syncComposer(value, "html");
                          setIsAutoDetectedHtml(false);
                        });
                      }}
                    />
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {formCopy.tokensLabel}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_BODY_TOKENS.map((token) => (
                      <Button key={token} type="button" variant="outline" size="sm" onClick={() => insertToken(token)}>
                        {token}
                      </Button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="grid gap-4">
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {formCopy.previewSubjectLabel}
                  </p>
                  <p className="text-lg font-semibold">{preview.subject || productContent.shared.noSubjectLabel}</p>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {formCopy.previewBodyLabel}
                  </p>
                  <TemplatePreviewBody
                    mode={bodyMode}
                    html={preview.bodyHtml}
                    text={preview.body}
                    viewport={previewViewport}
                    compact
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-lg font-semibold tracking-[-0.03em] text-foreground">{formCopy.livePreviewTitle}</p>
              <p className="text-sm leading-6 text-muted-foreground">{formCopy.livePreviewDescription}</p>
            </div>
            {bodyMode === "html" && preview.bodyHtml ? (
              <div className="glass-control inline-flex items-center gap-1 rounded-[1.1rem] p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={previewViewport === "desktop" ? "secondary" : "ghost"}
                  onClick={() => setPreviewViewport("desktop")}
                >
                  <Monitor className="size-4" />
                  {formCopy.previewDesktopLabel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={previewViewport === "mobile" ? "secondary" : "ghost"}
                  onClick={() => setPreviewViewport("mobile")}
                >
                  <Smartphone className="size-4" />
                  {formCopy.previewMobileLabel}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {formCopy.previewSubjectLabel}
            </p>
            <p className="text-lg font-semibold">{preview.subject || productContent.shared.noSubjectLabel}</p>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {formCopy.previewBodyLabel}
            </p>
            <TemplatePreviewBody
              mode={bodyMode}
              html={preview.bodyHtml}
              text={preview.body}
              viewport={previewViewport}
            />
          </div>

          <div className="mt-4 rounded-[1.25rem] border border-dashed border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            {formCopy.sampleContactLabel}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
