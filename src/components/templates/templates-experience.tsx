"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, FilePlus2, Monitor, Search, Smartphone } from "lucide-react";
import { TemplateForm } from "@/components/forms/template-form";
import { PageHeader } from "@/components/layout/page-header";
import { EmailPreviewFrame } from "@/components/templates/email-preview-frame";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { productContent } from "@/content/product";
import {
  getFeaturedTemplates,
  getTemplateModeLabel,
  matchesTemplateFilter,
  matchesTemplateQuery,
  type TemplateGalleryFilter,
  type TemplateListItem,
} from "@/lib/templates/gallery";

type PreviewViewport = "desktop" | "mobile";

function TemplateSurface({
  template,
  featured = false,
  fullPreview = false,
  viewport = "desktop",
}: {
  template: TemplateListItem;
  featured?: boolean;
  fullPreview?: boolean;
  viewport?: PreviewViewport;
}) {
  if (template.body_html_template) {
    const maxCanvasHeight = fullPreview ? undefined : featured ? 260 : 188;

    return (
      <div className="overflow-hidden rounded-[1.5rem] border border-white/65 bg-[linear-gradient(180deg,rgba(248,251,253,0.98),rgba(236,242,246,0.92))]">
        <div className={fullPreview ? "p-4" : featured ? "p-3.5" : "p-3"}>
          <EmailPreviewFrame
            key={`${template.id}-${viewport}-${fullPreview ? "full" : featured ? "featured" : "gallery"}`}
            html={template.body_html_template}
            viewport={viewport}
            presentation={fullPreview ? "reader" : "thumbnail"}
            viewportHeight={fullPreview ? "clamp(24rem, calc(88vh - 17rem), 58rem)" : undefined}
            maxCanvasHeight={maxCanvasHeight}
            className="rounded-[1.25rem]"
            frameClassName="overflow-hidden rounded-[1.25rem] bg-white shadow-[0_22px_48px_rgba(17,39,63,0.16)]"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[1.5rem] border border-white/60 bg-white/70 p-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground ${
        fullPreview ? "min-h-[18rem]" : featured ? "min-h-[14rem]" : "min-h-[11.5rem]"
      }`}
    >
      {template.body_template || productContent.shared.noBodyLabel}
    </div>
  );
}

function TemplateActions({
  template,
  onPreview,
}: {
  template: TemplateListItem;
  onPreview: (template: TemplateListItem) => void;
}) {
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => onPreview(template)}>
        <Eye className="size-4" />
        Preview
      </Button>
      <Button asChild>
        <Link href={`/campaigns/new?templateId=${template.id}`}>Select this template</Link>
      </Button>
    </>
  );
}

function TemplateCard({
  template,
  onPreview,
  featured = false,
}: {
  template: TemplateListItem;
  onPreview: (template: TemplateListItem) => void;
  featured?: boolean;
}) {
  return (
    <Card
      className={`group relative overflow-hidden ${
        featured ? "border-[rgba(215,237,247,0.82)] shadow-[0_24px_56px_rgba(17,39,63,0.14)]" : ""
      }`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>{template.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{template.subject_template}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {template.is_system_template ? <Badge variant="success">Ready to use</Badge> : null}
            {template.category ? <Badge variant="neutral">{template.category}</Badge> : null}
            {template.design_preset ? <Badge variant="neutral">{template.design_preset}</Badge> : null}
          </div>
        </div>
        <Badge variant={template.body_html_template ? "success" : "neutral"}>
          {getTemplateModeLabel(template)}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="relative">
          <TemplateSurface template={template} featured={featured} />
          <div className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-[1.75rem] bg-[linear-gradient(180deg,rgba(12,27,42,0.08),rgba(12,27,42,0.62))] opacity-0 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100 md:flex">
            <div className="pointer-events-auto flex flex-wrap justify-center gap-3 px-4">
              <TemplateActions template={template} onPreview={onPreview} />
            </div>
          </div>
        </div>
        <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
          {(template.preview_text ?? template.body_template.slice(0, 180)) || productContent.shared.noBodyLabel}
        </div>
        {template.tags?.length ? (
          <div className="flex flex-wrap gap-2">
            {template.tags.map((tag) => (
              <Badge key={`${template.id}-${tag}`} variant="neutral">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3 md:hidden">
          <TemplateActions template={template} onPreview={onPreview} />
        </div>
      </CardContent>
    </Card>
  );
}

export function TemplatesExperience({ templates }: { templates: TemplateListItem[] }) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState<TemplateGalleryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<TemplateListItem | null>(null);
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>("desktop");
  const featuredTemplates = useMemo(() => getFeaturedTemplates(templates), [templates]);
  const galleryTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          matchesTemplateFilter(template, galleryFilter) &&
          matchesTemplateQuery(template, searchQuery),
      ),
    [galleryFilter, searchQuery, templates],
  );

  const handlePreviewTemplate = (template: TemplateListItem) => {
    setPreviewViewport("desktop");
    setPreviewTemplate(template);
  };

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={productContent.templates.header.eyebrow}
        title={productContent.templates.header.title}
        description={productContent.templates.header.description}
        actions={
          <Button type="button" onClick={() => setIsComposerOpen(true)}>
            <FilePlus2 className="size-4" />
            Create from scratch
          </Button>
        }
      />

      {isComposerOpen ? (
        <TemplateForm
          initialMode="text"
          title="Create from scratch"
          onCancel={() => setIsComposerOpen(false)}
          onSaved={() => setIsComposerOpen(false)}
        />
      ) : null}

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-[-0.05em] text-foreground">Featured templates</h2>
            <p className="text-sm text-muted-foreground">
              Start with the two default templates pinned for this workspace.
            </p>
          </div>
          <Badge variant="success">{featuredTemplates.length} pinned</Badge>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {featuredTemplates.map((template) => (
            <TemplateCard
              key={`featured-${template.id}`}
              template={template}
              onPreview={handlePreviewTemplate}
              featured
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-[-0.05em] text-foreground">Gallery</h2>
            <p className="text-sm text-muted-foreground">
              Browse saved and default templates, filter by category, and preview before launching.
            </p>
          </div>
          <Badge variant="neutral">{galleryTemplates.length} visible</Badge>
        </div>

        <div className="grid gap-4 rounded-[2rem] border border-white/70 bg-white/46 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
          <Tabs value={galleryFilter} onValueChange={(value) => setGalleryFilter(value as TemplateGalleryFilter)}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="all">All Templates</TabsTrigger>
              <TabsTrigger value="default">Default</TabsTrigger>
              <TabsTrigger value="saved">Saved</TabsTrigger>
              <TabsTrigger value="follow-up">Follow-up</TabsTrigger>
              <TabsTrigger value="launch">Launch</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search templates by name, subject, tag, or category"
              className="h-12 rounded-[1.15rem] pl-11"
            />
          </div>
        </div>

        {galleryTemplates.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {galleryTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} onPreview={handlePreviewTemplate} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="px-6 py-10 text-sm text-muted-foreground">
              No templates match the current gallery filters.
            </CardContent>
          </Card>
        )}
      </section>

      <Dialog open={Boolean(previewTemplate)} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        {previewTemplate ? (
          <DialogContent className="max-h-[88vh] overflow-hidden p-0">
            <DialogHeader className="border-b border-white/70 px-6 py-5">
              <DialogTitle className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
                {previewTemplate.name}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                {previewTemplate.subject_template}
              </DialogDescription>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={previewTemplate.body_html_template ? "success" : "neutral"}>
                    {getTemplateModeLabel(previewTemplate)}
                  </Badge>
                  {previewTemplate.category ? <Badge variant="neutral">{previewTemplate.category}</Badge> : null}
                  {previewTemplate.is_system_template ? <Badge variant="success">Default</Badge> : null}
                </div>
                {previewTemplate.body_html_template ? (
                  <div className="glass-control inline-flex items-center gap-1 rounded-[1.1rem] p-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={previewViewport === "desktop" ? "secondary" : "ghost"}
                      onClick={() => setPreviewViewport("desktop")}
                    >
                      <Monitor className="size-4" />
                      Desktop
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={previewViewport === "mobile" ? "secondary" : "ghost"}
                      onClick={() => setPreviewViewport("mobile")}
                    >
                      <Smartphone className="size-4" />
                      Mobile
                    </Button>
                  </div>
                ) : null}
              </div>
            </DialogHeader>

            <div
              className={`grid gap-4 px-6 py-5 ${
                previewTemplate.body_html_template ? "overflow-hidden" : "max-h-[calc(88vh-12rem)] overflow-y-auto"
              }`}
            >
              <TemplateSurface
                template={previewTemplate}
                featured
                fullPreview
                viewport={previewViewport}
              />
              {!previewTemplate.body_html_template ? (
                <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                  {(previewTemplate.preview_text ?? previewTemplate.body_template.slice(0, 220)) ||
                    productContent.shared.noBodyLabel}
                </div>
              ) : null}
            </div>

            <DialogFooter className="border-t border-white/70 px-6 py-5">
              <Button type="button" variant="outline" onClick={() => setPreviewTemplate(null)}>
                Close
              </Button>
              <Button asChild>
                <Link href={`/campaigns/new?templateId=${previewTemplate.id}`}>Select this template</Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
