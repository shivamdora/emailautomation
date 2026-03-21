"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { LogOut, Settings2, Sparkles } from "lucide-react";
import { GmailMark } from "@/components/icons/gmail-mark";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import { productContent } from "@/content/product";
import {
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  parseSidebarCollapsed,
  serializeSidebarCollapsed,
} from "@/lib/layout/sidebar-persistence";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_EVENT = "outboundflow:sidebar-collapsed";

function subscribeToSidebarPreference(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => callback();
  window.addEventListener("storage", handleChange);
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, handleChange);
  };
}

function getSidebarPreferenceSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return parseSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY));
}

export function AppShell({
  children,
  brandSubtitle = productContent.shell.brand.subtitle,
  shellTitle,
  activeProjectId,
  projects,
  workspaceName,
}: {
  children: ReactNode;
  brandSubtitle?: string;
  shellTitle?: string;
  activeProjectId: string;
  workspaceName: string;
  projects: Array<{
    id: string;
    workspace_id: string;
    name: string;
    slug: string;
    website: string | null;
    logo_url: string | null;
    brand_name: string | null;
    sender_display_name: string | null;
    sender_title: string | null;
    sender_signature: string | null;
  }>;
}) {
  const isDesktopSidebarCollapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarPreferenceSnapshot,
    () => false,
  );

  const setSidebarCollapsed = (value: boolean) => {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      serializeSidebarCollapsed(value),
    );
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
  };

  return (
    <div className="page-gradient min-h-screen px-3 py-3 sm:px-4 sm:py-4">
      <div
        className={cn(
          "relative mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1800px] flex-col gap-3 transition-[grid-template-columns] duration-300 ease-out xl:grid",
          isDesktopSidebarCollapsed
            ? "xl:grid-cols-[96px_minmax(0,1fr)]"
            : "xl:grid-cols-[320px_minmax(0,1fr)]",
        )}
      >
        <div className="pointer-events-none absolute inset-x-12 top-0 h-72 rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.88),transparent_64%)]" />

        <div className="glass-nav relative z-10 rounded-[32px] p-4 text-sidebar-foreground shadow-[0_24px_56px_rgba(17,39,63,0.12)] xl:hidden">
          <div className="flex items-start justify-between gap-4">
            <Link href="/dashboard" className="min-w-0 space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-sidebar-muted">
                {productContent.shell.brand.name}
              </p>
              <p className="text-lg font-semibold tracking-[-0.05em] text-sidebar-foreground">
                {shellTitle ?? brandSubtitle}
              </p>
            </Link>
            <form action="/api/auth/sign-out" method="post">
              <Button type="submit" size="sm" variant="outline" className="justify-center">
                <LogOut className="size-4" />
                {productContent.shell.signOutLabel}
              </Button>
            </form>
          </div>

          <div className="mt-4">
            <ProjectSwitcher
              activeProjectId={activeProjectId}
              projects={projects}
              workspaceName={workspaceName}
            />
          </div>

          <div className="mt-4">
            <SidebarNav orientation="horizontal" />
          </div>
        </div>

        <aside className="hidden xl:block">
          <div
            className={cn(
              "sidebar-shell glass-nav sticky top-4 flex h-[calc(100vh-2rem)] min-h-0 flex-col overflow-hidden rounded-[34px] p-6 text-sidebar-foreground shadow-[0_26px_68px_rgba(17,39,63,0.14)] transition-[padding] duration-300 ease-out",
              isDesktopSidebarCollapsed ? "sidebar-shell-collapsed px-4 py-5" : "",
            )}
          >
            <div
              className={cn(
                "sidebar-brand-row mb-8 flex items-start gap-4",
                isDesktopSidebarCollapsed ? "justify-center" : "justify-between",
              )}
            >
              {!isDesktopSidebarCollapsed ? (
                <Link
                  href="/dashboard"
                  aria-label={productContent.shell.brand.name}
                  className="min-w-0 space-y-2 transition-all duration-300"
                >
                  <>
                    <p className="sidebar-brand-kicker font-mono text-[11px] uppercase tracking-[0.34em] text-sidebar-muted">
                      {productContent.shell.brand.name}
                    </p>
                    <p className="sidebar-brand-title text-[32px] font-semibold tracking-[-0.06em] text-sidebar-foreground">
                      {shellTitle ?? brandSubtitle}
                    </p>
                  </>
                </Link>
              ) : null}

              <button
                type="button"
                aria-pressed={isDesktopSidebarCollapsed}
                aria-label={isDesktopSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => setSidebarCollapsed(!isDesktopSidebarCollapsed)}
                className={cn(
                  "sidebar-sparkle glass-chip group relative flex size-11 items-center justify-center overflow-hidden rounded-[1.35rem] transition-[transform,box-shadow,background-color] duration-300 ease-out hover:-translate-y-0.5 hover:rotate-[2deg] hover:shadow-[0_18px_36px_rgba(17,39,63,0.16)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
                  isDesktopSidebarCollapsed ? "bg-white/78" : "",
                )}
              >
                <span className="pointer-events-none absolute inset-[1px] rounded-[1.2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.5),rgba(255,255,255,0),rgba(215,237,247,0.55))] opacity-0 transition duration-300 group-hover:opacity-100" />
                <Sparkles
                  className={cn(
                    "relative size-5 text-primary transition-transform duration-300 ease-out",
                    isDesktopSidebarCollapsed
                      ? "-rotate-12 scale-[0.94]"
                      : "group-hover:rotate-12 group-hover:scale-110",
                  )}
                />
              </button>
            </div>

            <div
              className={cn(
                "sidebar-nav-region scrollbar-none min-h-0 flex-1 overflow-y-auto",
                isDesktopSidebarCollapsed ? "overflow-x-visible pr-0" : "pr-1",
              )}
            >
              <div className={cn("mb-5", isDesktopSidebarCollapsed ? "flex justify-center" : "")}>
                <ProjectSwitcher
                  activeProjectId={activeProjectId}
                  projects={projects}
                  workspaceName={workspaceName}
                  compact={isDesktopSidebarCollapsed}
                />
              </div>
              <SidebarNav collapsed={isDesktopSidebarCollapsed} />
            </div>

            {isDesktopSidebarCollapsed ? (
              <div className="mt-5 grid justify-center gap-3">
                <Link
                  href="/settings/sending"
                  aria-label={productContent.profile.gmailCard.connectLabel}
                  title={productContent.profile.gmailCard.connectLabel}
                  className="glass-chip flex size-12 items-center justify-center rounded-[1.25rem] text-sidebar-foreground transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(17,39,63,0.12)]"
                >
                  <GmailMark className="size-5" />
                </Link>
                <form action="/api/auth/sign-out" method="post">
                  <button
                    type="submit"
                    aria-label={productContent.shell.signOutLabel}
                    title={productContent.shell.signOutLabel}
                    className="glass-chip flex size-12 items-center justify-center rounded-[1.25rem] text-sidebar-foreground transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(17,39,63,0.12)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
                  >
                    <LogOut className="size-4" />
                  </button>
                </form>
              </div>
            ) : (
              <div className="sidebar-helper glass-control mt-6 min-h-fit shrink-0 overflow-hidden rounded-[30px] p-5 xl:p-6">
                <p className="sidebar-helper-title text-sm font-semibold tracking-[-0.02em] text-sidebar-foreground">
                  {productContent.shell.helper.title}
                </p>
                <p className="sidebar-helper-copy mt-2 text-sm leading-6 text-sidebar-muted">
                  {productContent.shell.helper.description}
                </p>
                <div className="sidebar-helper-actions">
                  <Button
                    asChild
                    type="button"
                    variant="outline"
                    className="sidebar-helper-button sidebar-helper-settings-button w-full justify-start"
                  >
                    <Link href="/settings">
                      <span className="sidebar-helper-settings-icon">
                        <span className="sidebar-helper-settings-orb" />
                        <Settings2 className="size-4.5 text-[var(--accent-foreground)]" />
                      </span>
                      <span className="min-w-0 truncate">
                        Work Settings
                      </span>
                    </Link>
                  </Button>
                  <form action="/api/auth/sign-out" method="post" className="sidebar-helper-form">
                    <Button
                      type="submit"
                      variant="outline"
                      className="sidebar-helper-button w-full justify-center"
                    >
                      <LogOut className="size-4" />
                      {productContent.shell.signOutLabel}
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="solid-content relative min-w-0 overflow-hidden rounded-[34px] p-4 sm:p-6 xl:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
