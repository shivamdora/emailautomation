"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;
export const SelectLabel = SelectPrimitive.Label;
export const SelectItemText = SelectPrimitive.ItemText;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "glass-control inline-flex min-h-[3.15rem] w-full items-center justify-between gap-3 rounded-[1.2rem] border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,248,253,0.72))] px-3.5 py-2.5 text-left text-sm font-medium text-foreground shadow-none transition-[background-color,border-color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55 hover:border-white/92 hover:bg-white/86 hover:shadow-[0_18px_34px_rgba(17,39,63,0.12)] data-[state=open]:bg-white/94 data-[state=open]:shadow-[0_22px_42px_rgba(17,39,63,0.14)] data-[placeholder]:text-muted-foreground [&>span]:truncate [&[data-state=open]_.select-chevron]:rotate-180 [&[data-state=open]_.select-chevron]:text-foreground",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="select-chevron size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
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
        "z-50 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[1.55rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,250,254,0.94))] shadow-[0_26px_64px_rgba(17,39,63,0.18)] backdrop-blur-[22px]",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="grid gap-1.5 p-2.5">
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
      "relative grid cursor-pointer grid-cols-[1fr_auto] items-center gap-3 rounded-[1.05rem] border border-transparent px-3.5 py-3 outline-none transition-[background-color,border-color,box-shadow,color] duration-200 ease-out hover:border-white/80 hover:bg-white/78 hover:shadow-[0_12px_24px_rgba(17,39,63,0.08)] focus:border-white/84 focus:bg-white/84 data-[state=checked]:border-[rgba(101,176,190,0.34)] data-[state=checked]:bg-[linear-gradient(180deg,rgba(227,244,248,0.98),rgba(255,255,255,0.96))] data-[state=checked]:shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_12px_24px_rgba(17,39,63,0.08)]",
      className,
    )}
    {...props}
  >
    <div className="grid min-w-0 gap-0.5">{children}</div>
    <SelectPrimitive.ItemIndicator>
      <Check className="size-4 text-accent-foreground" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));

SelectItem.displayName = SelectPrimitive.Item.displayName;
