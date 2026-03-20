"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ContactRound,
  FolderInput,
  Inbox,
  LayoutDashboard,
  LineChart,
  Mail,
  Settings,
  UserCircle2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { productContent } from "@/content/product";
import {
  getDefaultOpenNavigationKeys,
  isNavigationItemActive,
  type ShellNavigationItem,
} from "@/lib/layout/navigation";
import { cn } from "@/lib/utils";

function renderNavIcon(href: string, className: string) {
  switch (href) {
    case "/analytics":
      return <LineChart className={className} />;
    case "/contacts":
      return <ContactRound className={className} />;
    case "/imports":
      return <FolderInput className={className} />;
    case "/templates":
      return <Mail className={className} />;
    case "/campaigns":
      return <BarChart3 className={className} />;
    case "/inbox":
      return <Inbox className={className} />;
    case "/settings":
      return <Settings className={className} />;
    case "/profile":
      return <UserCircle2 className={className} />;
    case "/dashboard":
    default:
      return <LayoutDashboard className={className} />;
  }
}

function MobileNavCard({
  item,
  pathname,
}: {
  item: ShellNavigationItem;
  pathname: string;
}) {
  const active = isNavigationItemActive(item, pathname);

  return (
    <section
      className={cn(
        "min-w-[15rem] rounded-[1.5rem] border p-2.5 shadow-none",
        active
          ? "glass-control border-[rgba(118,174,201,0.42)] bg-[linear-gradient(180deg,rgba(215,237,247,0.9),rgba(250,253,255,0.82))]"
          : "glass-control border-white/60 bg-white/52",
      )}
    >
      <Link
        href={item.href}
        aria-current={pathname === item.href ? "page" : undefined}
        className="group flex items-center gap-3 rounded-[1.05rem] px-2 py-2 transition hover:bg-white/54"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[1rem] border",
            active
              ? "border-white/72 bg-white/80 text-sidebar-foreground"
              : "border-white/45 bg-white/48 text-sidebar-muted group-hover:text-sidebar-foreground",
          )}
        >
          {renderNavIcon(item.href, "size-4")}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-[-0.02em] text-sidebar-foreground">
            {item.label}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sidebar-muted">
            {item.children?.length ? `${item.children.length} shortcuts` : "Workspace page"}
          </p>
        </div>
      </Link>
      {item.children?.length ? (
        <div className="mt-2 grid gap-2">
          {item.children.map((child) => {
            const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);

            return (
              <Link
                key={child.href}
                href={child.href}
                aria-current={childActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-[1.1rem] border px-3 py-2.5 text-sm font-medium transition",
                  childActive
                    ? "border-white/80 bg-white/78 text-sidebar-foreground shadow-[0_14px_30px_rgba(17,39,63,0.1)]"
                    : "border-transparent text-sidebar-muted hover:border-white/55 hover:bg-white/52 hover:text-sidebar-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-[0.9rem] border",
                    childActive
                      ? "border-white/72 bg-white/80"
                      : "border-white/40 bg-white/42",
                  )}
                >
                  {renderNavIcon(child.href, "size-4")}
                </span>
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function DesktopExpandedNavItem({
  item,
  pathname,
  open,
  onToggle,
}: {
  item: ShellNavigationItem;
  pathname: string;
  open: boolean;
  onToggle: () => void;
}) {
  const active = isNavigationItemActive(item, pathname);
  const activeParentRoute = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const hasChildren = Boolean(item.children?.length);

  return (
    <div className="grid gap-2">
      <div
        className={cn(
            "group flex items-center gap-1.5 rounded-[1.1rem] border p-1 transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out",
          active
            ? "border-[rgba(118,174,201,0.42)] bg-[linear-gradient(180deg,rgba(215,237,247,0.94),rgba(250,253,255,0.84))] text-accent-foreground shadow-[0_14px_28px_rgba(17,39,63,0.1)]"
            : "border-transparent bg-transparent text-sidebar-muted hover:border-white/55 hover:bg-white/44 hover:text-sidebar-foreground hover:shadow-[0_10px_22px_rgba(17,39,63,0.06)]",
        )}
      >
        <Link
          href={item.href}
          aria-current={activeParentRoute ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[0.95rem] px-2.5 py-2"
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-[0.9rem] border transition-colors duration-200",
              active
                ? "border-[rgba(118,174,201,0.34)] bg-white/92 text-accent-foreground"
                : "border-transparent bg-transparent text-sidebar-muted group-hover:border-white/58 group-hover:bg-white/48 group-hover:text-sidebar-foreground",
            )}
          >
            {renderNavIcon(item.href, "size-4")}
          </span>
          <span className="min-w-0 truncate text-[13px] font-medium tracking-[-0.01em]" title={item.label}>
            {item.label}
          </span>
        </Link>
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${item.label}`}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-[0.9rem] border transition",
              active
                ? "border-[rgba(118,174,201,0.34)] bg-white/88 text-accent-foreground"
                : "border-transparent bg-transparent text-sidebar-muted hover:border-white/58 hover:bg-white/46 hover:text-sidebar-foreground",
            )}
          >
            <ChevronDown
              className={cn("size-4 transition-transform duration-200", open ? "rotate-180" : "")}
            />
          </button>
        ) : null}
      </div>

      {hasChildren ? (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="grid gap-1.5 pl-3.5 pr-1 pt-1">
              {item.children?.map((child) => {
                const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);

                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    aria-current={childActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[0.95rem] border px-2.5 py-2 text-[13px] transition",
                      childActive
                        ? "border-[rgba(118,174,201,0.38)] bg-[rgba(215,237,247,0.72)] text-accent-foreground"
                        : "border-transparent text-sidebar-muted hover:border-white/52 hover:bg-white/46 hover:text-sidebar-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6.5 shrink-0 items-center justify-center rounded-[0.8rem] border",
                        childActive
                          ? "border-[rgba(118,174,201,0.34)] bg-white/88 text-accent-foreground"
                          : "border-white/38 bg-white/38 text-sidebar-muted",
                      )}
                    >
                      {renderNavIcon(child.href, "size-3.5")}
                    </span>
                    <span className="truncate">{child.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DesktopCollapsedNavItem({
  item,
  pathname,
}: {
  item: ShellNavigationItem;
  pathname: string;
}) {
  const active = isNavigationItemActive(item, pathname);
  const triggerClassName = cn(
    "group flex h-[2.9rem] w-full items-center justify-center rounded-[1.05rem] border transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out",
    active
      ? "border-[rgba(118,174,201,0.44)] bg-[linear-gradient(180deg,rgba(215,237,247,0.94),rgba(250,253,255,0.84))] text-accent-foreground shadow-[0_12px_24px_rgba(17,39,63,0.1)]"
      : "border-transparent bg-transparent text-sidebar-muted hover:border-white/55 hover:bg-white/44 hover:text-sidebar-foreground hover:shadow-[0_10px_20px_rgba(17,39,63,0.06)]",
  );
  const icon = (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-[0.9rem] border transition-colors duration-200",
        active
          ? "border-[rgba(118,174,201,0.34)] bg-white/92 text-accent-foreground"
          : "border-transparent bg-transparent text-sidebar-muted group-hover:border-white/58 group-hover:bg-white/52 group-hover:text-sidebar-foreground",
      )}
    >
      {renderNavIcon(item.href, "size-4")}
    </span>
  );

  if (!item.children?.length) {
    return (
      <Link
        href={item.href}
        aria-current={pathname === item.href ? "page" : undefined}
        aria-label={item.label}
        title={item.label}
        className={triggerClassName}
      >
        {icon}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-current={pathname === item.href ? "page" : undefined}
          aria-label={item.label}
          title={item.label}
          className={triggerClassName}
        >
          {icon}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="min-w-[13.75rem]">
        <div className="px-2.5 pb-1.5 pt-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sidebar-muted">
            Quick navigation
          </p>
          <p className="mt-1 text-sm font-semibold tracking-[-0.02em] text-foreground">{item.label}</p>
        </div>
        <DropdownMenuItem asChild className="rounded-[0.9rem] px-2.5 py-2">
          <Link href={item.href} className="justify-between">
            <span>Open {item.label}</span>
          </Link>
        </DropdownMenuItem>
        {item.children.map((child) => {
          const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);

          return (
            <DropdownMenuItem key={child.href} asChild className="rounded-[0.9rem] px-2.5 py-2">
              <Link
                href={child.href}
                aria-current={childActive ? "page" : undefined}
                className={cn(
                  "justify-between",
                  childActive ? "bg-[rgba(215,237,247,0.78)]" : "",
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-6.5 items-center justify-center rounded-[0.8rem] border border-white/60 bg-white/78">
                    {renderNavIcon(child.href, "size-4")}
                  </span>
                  <span>{child.label}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SidebarNav({
  orientation = "vertical",
  collapsed = false,
}: {
  orientation?: "vertical" | "horizontal";
  collapsed?: boolean;
}) {
  const pathname = usePathname() ?? "/dashboard";
  const items = productContent.shell.navigation;
  const [manuallyOpenKeys, setManuallyOpenKeys] = useState<string[]>([]);
  const activeOpenKeys = getDefaultOpenNavigationKeys(items, pathname);
  const openKeys = Array.from(new Set([...manuallyOpenKeys, ...activeOpenKeys]));

  const toggleGroup = (href: string) => {
    setManuallyOpenKeys((current) =>
      current.includes(href) ? current.filter((key) => key !== href) : [...current, href],
    );
  };

  if (orientation === "horizontal") {
    return (
      <nav className="scrollbar-none min-w-0 overflow-x-auto">
        <div className="flex min-w-max gap-3 pb-1">
          {items.map((item) => (
            <MobileNavCard key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav className="min-w-0">
      <div className={cn("grid", collapsed ? "gap-2" : "gap-3")}>
        {items.map((item) =>
          collapsed ? (
            <DesktopCollapsedNavItem key={item.href} item={item} pathname={pathname} />
          ) : (
            <DesktopExpandedNavItem
              key={item.href}
              item={item}
              pathname={pathname}
              open={openKeys.includes(item.href)}
              onToggle={() => toggleGroup(item.href)}
            />
          ),
        )}
      </div>
    </nav>
  );
}
