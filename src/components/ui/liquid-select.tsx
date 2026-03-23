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
import { cn } from "@/lib/utils";

type LiquidSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
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
          <SelectValue placeholder={placeholder} />
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
                <span className="truncate text-sm font-semibold tracking-[-0.02em] text-foreground">
                  {option.label}
                </span>
              </SelectItemText>
              {option.description ? (
                <span className="truncate text-[11px] leading-5 text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
