"use client";

import { useMemo } from "react";
import { sanitizeHtml } from "@/lib/utils/html";

export function SafeHtmlContent({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const sanitized = useMemo(() => sanitizeHtml(html), [html]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
