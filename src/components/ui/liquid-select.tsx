"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProjectMonogram } from "@/lib/projects/shared";
import { cn } from "@/lib/utils";

type LiquidSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  avatarName?: string;
  avatarBrandName?: string | null;
  avatarLogoUrl?: string | null;
};

type LiquidSelectProps = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  options: LiquidSelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
  onValueChange?: (value: string) => void;
};

function renderOptionAvatar(option: LiquidSelectOption, sizeClassName: string) {
  const avatarName = option.avatarName ?? option.label;

  if (!option.avatarLogoUrl && !option.avatarName && !option.avatarBrandName) {
    return null;
  }

  if (option.avatarLogoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={option.avatarLogoUrl}
        alt={avatarName}
        className={cn(
          "shrink-0 border border-white/75 object-cover shadow-[0_12px_24px_rgba(17,39,63,0.1)]",
          sizeClassName,
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center border border-white/78 bg-[linear-gradient(180deg,rgba(215,237,247,0.92),rgba(255,255,255,0.84))] font-mono text-[10px] uppercase tracking-[0.2em] text-accent-foreground shadow-[0_12px_24px_rgba(17,39,63,0.08)]",
        sizeClassName,
      )}
    >
      {getProjectMonogram({
        name: avatarName,
        brand_name: option.avatarBrandName ?? null,
      })}
    </span>
  );
}

function renderOptionContent(option: LiquidSelectOption, context: "trigger" | "item") {
  const avatar = renderOptionAvatar(
    option,
    context === "trigger" ? "size-8 rounded-[0.9rem]" : "size-9 rounded-[0.95rem]",
  );

  if (!avatar) {
    return (
      <>
        <span className="truncate text-sm font-semibold tracking-[-0.02em] text-foreground">
          {option.label}
        </span>
      </>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-3">
      {avatar}
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-sm font-semibold tracking-[-0.02em] text-foreground">
          {option.label}
        </span>
      </span>
    </span>
  );
}

function renderOptionDescription(option: LiquidSelectOption) {
  return option.description ? (
    <span className="truncate text-[11px] leading-5 text-muted-foreground">{option.description}</span>
  ) : null;
}

export function LiquidSelect({
  id,
  name,
  value,
  defaultValue,
  options,
  placeholder,
  ariaLabel,
  disabled,
  triggerClassName,
  contentClassName,
  itemClassName,
  onValueChange,
}: LiquidSelectProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");

  React.useEffect(() => {
    if (!isControlled) {
      setInternalValue(defaultValue ?? "");
    }
  }, [defaultValue, isControlled]);

  const resolvedValue = isControlled ? value ?? "" : internalValue;
  const hasCurrentValue = options.some((option) => option.value === resolvedValue);
  const selectedOption = options.find((option) => option.value === resolvedValue);

  return (
    <>
      {name ? <input type="hidden" name={name} value={resolvedValue} /> : null}
      <Select
        value={hasCurrentValue ? resolvedValue : undefined}
        onValueChange={(nextValue) => {
          if (!isControlled) {
            setInternalValue(nextValue);
          }
          onValueChange?.(nextValue);
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} aria-label={ariaLabel} className={cn("w-full", triggerClassName)}>
          <SelectValue placeholder={placeholder}>
            {selectedOption ? renderOptionContent(selectedOption, "trigger") : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className={contentClassName}>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className={itemClassName}
            >
              <SelectItemText>
                <span className="sr-only">{option.label}</span>
              </SelectItemText>
              <span aria-hidden="true" className="grid min-w-0 gap-0.5">
                {renderOptionContent(option, "item")}
                {renderOptionDescription(option)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
