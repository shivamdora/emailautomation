"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 10, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[13rem] overflow-hidden rounded-[1.2rem] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,249,253,0.94))] p-1 shadow-[0_20px_48px_rgba(17,39,63,0.16)]",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));

DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "flex cursor-pointer items-center gap-2.5 rounded-[0.9rem] px-3 py-2 text-sm font-medium text-foreground outline-none transition hover:bg-white/82 focus:bg-white/82",
      className,
    )}
    {...props}
  />
));

DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export function DropdownMenuChevron({
  className,
}: {
  className?: string;
}) {
  return <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", className)} />;
}
