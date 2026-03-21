"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildEmailPreviewDocument } from "@/lib/templates/preview-frame";
import { cn } from "@/lib/utils";

const PREVIEW_WIDTH = {
  desktop: 620,
  mobile: 390,
} as const;

const PREVIEW_MIN_HEIGHT = {
  desktop: 860,
  mobile: 720,
} as const;

type EmailPreviewViewport = keyof typeof PREVIEW_WIDTH;
type EmailPreviewPresentation = "thumbnail" | "reader";

export function EmailPreviewFrame({
  html,
  viewport = "desktop",
  presentation = "thumbnail",
  className,
  frameClassName,
  maxCanvasHeight,
  viewportHeight,
}: {
  html: string;
  viewport?: EmailPreviewViewport;
  presentation?: EmailPreviewPresentation;
  className?: string;
  frameClassName?: string;
  maxCanvasHeight?: number;
  viewportHeight?: number | string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [documentHeight, setDocumentHeight] = useState<number>(PREVIEW_MIN_HEIGHT[viewport]);
  const [scale, setScale] = useState(1);
  const previewWidth = PREVIEW_WIDTH[viewport];
  const srcDoc = useMemo(() => buildEmailPreviewDocument(html), [html]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateScale = () => {
      const nextScale = Math.min(1, container.clientWidth / previewWidth);
      setScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);

    return () => observer.disconnect();
  }, [previewWidth]);

  useEffect(() => {
    const iframe = iframeRef.current;

    if (!iframe) {
      return;
    }

    let resizeObserver: ResizeObserver | null = null;
    const cleanups: Array<() => void> = [];

    const measure = () => {
      const documentNode = iframe.contentDocument;
      const body = documentNode?.body;
      const root = documentNode?.documentElement;

      if (!documentNode || !body || !root) {
        return;
      }

      const nextHeight = Math.max(
        PREVIEW_MIN_HEIGHT[viewport],
        body.scrollHeight,
        body.offsetHeight,
        root.scrollHeight,
        root.offsetHeight,
      );

      setDocumentHeight(nextHeight);
    };

    const attach = () => {
      const documentNode = iframe.contentDocument;
      const body = documentNode?.body;
      const root = documentNode?.documentElement;

      if (!documentNode || !body || !root) {
        return;
      }

      measure();

      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(body);
      resizeObserver.observe(root);

      for (const image of Array.from(documentNode.images)) {
        const handleImageLoad = () => measure();
        image.addEventListener("load", handleImageLoad);
        cleanups.push(() => image.removeEventListener("load", handleImageLoad));
      }
    };

    const handleLoad = () => attach();
    iframe.addEventListener("load", handleLoad);

    if (iframe.contentDocument?.readyState === "complete") {
      attach();
    }

    return () => {
      iframe.removeEventListener("load", handleLoad);
      resizeObserver?.disconnect();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [srcDoc, viewport]);

  const scaledWidth = Math.max(Math.round(previewWidth * scale), 1);
  const scaledHeight = Math.max(Math.round(documentHeight * scale), 120);
  const visibleHeight = maxCanvasHeight
    ? Math.min(maxCanvasHeight, scaledHeight)
    : Math.max(scaledHeight, PREVIEW_MIN_HEIGHT[viewport] * scale);
  const resolvedReaderHeight = viewportHeight ?? "clamp(24rem, calc(88vh - 16rem), 56rem)";
  const sharedFrameClassName = cn(
    "bg-white transition-[transform] duration-200 ease-out",
    presentation === "reader" ? "origin-top-left" : "origin-top",
    frameClassName,
  );

  if (presentation === "reader") {
    return (
      <div ref={containerRef} className={cn("relative w-full", className)}>
        <div
          className="overflow-y-auto overflow-x-hidden rounded-[1.35rem] border border-white/70 bg-[linear-gradient(180deg,rgba(248,251,253,0.98),rgba(236,242,246,0.92))] p-4"
          style={{ height: resolvedReaderHeight }}
        >
          <div className="flex min-w-full justify-center">
            <div
              className="relative"
              style={{
                width: scaledWidth,
                height: scaledHeight,
              }}
            >
              <div
                className={sharedFrameClassName}
                style={{
                  width: previewWidth,
                  height: documentHeight,
                  transform: `scale(${scale})`,
                }}
              >
                <iframe
                  ref={iframeRef}
                  title="Email template preview"
                  sandbox="allow-same-origin"
                  srcDoc={srcDoc}
                  className="block h-full w-full border-0 bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", maxCanvasHeight ? "overflow-hidden" : "", className)}
      style={{ height: visibleHeight }}
    >
      <div className="absolute left-1/2 top-0 -translate-x-1/2">
        <div
          className={sharedFrameClassName}
          style={{
            width: previewWidth,
            height: documentHeight,
            transform: `scale(${scale})`,
          }}
        >
          <iframe
            ref={iframeRef}
            title="Email template preview"
            sandbox="allow-same-origin"
            srcDoc={srcDoc}
            className="block h-full w-full border-0 bg-white"
          />
        </div>
      </div>
    </div>
  );
}
