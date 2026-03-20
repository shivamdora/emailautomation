"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;
export const SelectLabel = SelectPrimitive.Label;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "glass-control inline-flex min-h-14 w-full items-center justify-between gap-3 rounded-[1.25rem] border-0 px-4 py-3 text-left shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));

SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "z-50 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[1.5rem] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,249,253,0.94))] shadow-[0_26px_72px_rgba(17,39,63,0.2)]",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="grid gap-1 p-2">
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));

SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative grid cursor-pointer grid-cols-[1fr_auto] items-center gap-3 rounded-[1.2rem] border border-transparent px-4 py-3 outline-none transition hover:border-white/75 hover:bg-white/76 focus:bg-white/82 data-[state=checked]:border-white/80 data-[state=checked]:bg-[rgba(215,237,247,0.64)]",
      className,
    )}
    {...props}
  >
    <div className="grid min-w-0 gap-1">{children}</div>
    <SelectPrimitive.ItemIndicator>
      <Check className="size-4 text-accent-foreground" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));

SelectItem.displayName = SelectPrimitive.Item.displayName;
