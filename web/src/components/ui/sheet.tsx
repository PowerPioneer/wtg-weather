"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { forwardRef } from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/cn";

export const Sheet = RadixDialog.Root;
export const SheetTrigger = RadixDialog.Trigger;
export const SheetClose = RadixDialog.Close;

const sheet = tv({
  base: [
    "fixed z-50 flex flex-col border bg-surface shadow-lg",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "duration-base ease-standard",
  ].join(" "),
  variants: {
    side: {
      right:
        "inset-y-0 right-0 h-full w-[var(--size-drawer,420px)] border-l border-border data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
      left:
        "inset-y-0 left-0 h-full w-[var(--size-drawer,420px)] border-r border-border data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
      top:
        "inset-x-0 top-0 w-full border-b border-border data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
      bottom:
        "inset-x-0 bottom-0 w-full rounded-t-xl border-t border-border data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
    },
  },
  defaultVariants: {
    side: "right",
  },
});

type SheetVariants = VariantProps<typeof sheet>;

export type SheetContentProps = React.ComponentPropsWithoutRef<typeof RadixDialog.Content> & {
  side?: SheetVariants["side"];
};

export const SheetOverlay = forwardRef<
  React.ElementRef<typeof RadixDialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Overlay>
>(function SheetOverlay({ className, ...rest }, ref) {
  return (
    <RadixDialog.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-overlay",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        className,
      )}
      {...rest}
    />
  );
});

export const SheetContent = forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  SheetContentProps
>(function SheetContent({ className, children, side, ...rest }, ref) {
  return (
    <RadixDialog.Portal>
      <SheetOverlay />
      <RadixDialog.Content ref={ref} className={cn(sheet({ side }), className)} {...rest}>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
});

export const SheetTitle = forwardRef<
  React.ElementRef<typeof RadixDialog.Title>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Title>
>(function SheetTitle({ className, ...rest }, ref) {
  return (
    <RadixDialog.Title
      ref={ref}
      className={cn("text-h3 font-display font-medium text-text", className)}
      {...rest}
    />
  );
});

export const SheetDescription = forwardRef<
  React.ElementRef<typeof RadixDialog.Description>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Description>
>(function SheetDescription({ className, ...rest }, ref) {
  return (
    <RadixDialog.Description
      ref={ref}
      className={cn("text-body-sm text-text-muted", className)}
      {...rest}
    />
  );
});
