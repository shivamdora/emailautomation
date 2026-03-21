"use client";

import Link from "next/link";
import { FolderKanban, LayoutDashboard, Mail, PlugZap, ShieldEllipsis } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const settingsNavItems = [
  {
    href: "/settings",
    label: "Overview",
    description: "Setup & readiness",
    icon: LayoutDashboard,
    match: (pathname: string) => pathname === "/settings",
  },
  {
    href: "/settings/sending",
    label: "Sending",
    description: "Mailboxes & approvals",
    icon: Mail,
    match: (pathname: string) => pathname.startsWith("/settings/sending"),
  },
  {
    href: "/settings/projects",
    label: "Projects",
    description: "Brand & sender",
    icon: FolderKanban,
    match: (pathname: string) => pathname.startsWith("/settings/projects"),
  },
  {
    href: "/settings/integrations",
    label: "Integrations",
    description: "CRM, alerts & sync",
    icon: PlugZap,
    match: (pathname: string) => pathname.startsWith("/settings/integrations"),
  },
  {
    href: "/settings/advanced",
    label: "Advanced",
    description: "Ops and diagnostics",
    icon: ShieldEllipsis,
    match: (pathname: string) => pathname.startsWith("/settings/advanced"),
  },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/72 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,253,0.84))] shadow-[0_20px_48px_rgba(17,39,63,0.08)]">
      <div className="grid gap-4 p-4 lg:gap-4 lg:p-5">
        <div className="grid gap-2 border-b border-white/70 pb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-sidebar-muted">
            Workspace settings
          </p>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-end">
            <p className="text-lg font-semibold tracking-[-0.04em] text-foreground">
              Choose what you want to manage
            </p>
            <p className="max-w-[42rem] text-sm leading-6 text-muted-foreground">
              Sending, projects, integrations, and advanced workspace controls live here in one clear navigation rail.
            </p>
          </div>
        </div>
        <nav className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {settingsNavItems.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex min-h-[4.4rem] items-center gap-3 rounded-[1.25rem] border px-3.5 py-3 transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out",
                  active
                    ? "border-[rgba(101,176,190,0.42)] bg-[linear-gradient(180deg,rgba(232,246,249,0.96),rgba(255,255,255,0.94))] shadow-[0_12px_24px_rgba(15,124,141,0.08)]"
                    : "bg-white/66 hover:-translate-y-0.5 hover:border-white/86 hover:bg-white/84 hover:shadow-[0_12px_22px_rgba(17,39,63,0.06)]",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-[0.95rem] border transition-colors duration-200",
                    active
                      ? "border-[rgba(101,176,190,0.24)] bg-white/96 text-accent-foreground shadow-[0_8px_18px_rgba(17,39,63,0.07)]"
                      : "border-white/65 bg-white/78 text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate text-[15px] font-semibold tracking-[-0.02em] text-foreground">
                    {item.label}
                  </span>
                  <span className="text-[11px] leading-4 text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                {active ? (
                  <span className="ml-auto rounded-full bg-[rgba(15,124,141,0.1)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-accent-foreground">
                    Current
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
