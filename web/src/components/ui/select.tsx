"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

export const Select = RadixSelect.Root;
export const SelectValue = RadixSelect.Value;
export const SelectGroup = RadixSelect.Group;

export const SelectTrigger = forwardRef<
  React.ElementRef<typeof RadixSelect.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Trigger>
>(function SelectTrigger({ className, children, ...rest }, ref) {
  return (
    <RadixSelect.Trigger
      ref={ref}
      className={cn(
        "inline-flex h-10 w-full items-center justify-between rounded-md border border-border-strong bg-surface px-3 text-body-sm text-text",
        "transition-colors duration-fast ease-standard",
        "data-[placeholder]:text-text-subtle",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
      <RadixSelect.Icon className="ml-2 text-text-muted">
        <CaretDown />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  );
});

export const SelectContent = forwardRef<
  React.ElementRef<typeof RadixSelect.Content>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Content>
>(function SelectContent({ className, children, position = "popper", ...rest }, ref) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        ref={ref}
        position={position}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-surface shadow-md",
          className,
        )}
        {...rest}
      >
        <RadixSelect.Viewport className="p-1">{children}</RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
});

export const SelectItem = forwardRef<
  React.ElementRef<typeof RadixSelect.Item>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Item>
>(function SelectItem({ className, children, ...rest }, ref) {
  return (
    <RadixSelect.Item
      ref={ref}
      className={cn(
        "relative flex h-9 cursor-pointer select-none items-center rounded-sm px-3 text-body-sm text-text",
        "data-[highlighted]:bg-surface-2 data-[highlighted]:outline-none",
        "data-[state=checked]:font-medium",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...rest}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  );
});

export const SelectLabel = forwardRef<
  React.ElementRef<typeof RadixSelect.Label>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Label>
>(function SelectLabel({ className, ...rest }, ref) {
  return (
    <RadixSelect.Label
      ref={ref}
      className={cn("px-3 py-2 text-label text-text-muted", className)}
      {...rest}
    />
  );
});

export const SelectSeparator = forwardRef<
  React.ElementRef<typeof RadixSelect.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Separator>
>(function SelectSeparator({ className, ...rest }, ref) {
  return (
    <RadixSelect.Separator
      ref={ref}
      className={cn("my-1 h-px bg-border", className)}
      {...rest}
    />
  );
});

function CaretDown() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
