"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

export const Tabs = RadixTabs.Root;

export const TabsList = forwardRef<
  React.ElementRef<typeof RadixTabs.List>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.List>
>(function TabsList({ className, ...rest }, ref) {
  return (
    <RadixTabs.List
      ref={ref}
      className={cn(
        "inline-flex h-10 items-center gap-1 rounded-md border border-border bg-surface-2 p-1",
        className,
      )}
      {...rest}
    />
  );
});

export const TabsTrigger = forwardRef<
  React.ElementRef<typeof RadixTabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger>
>(function TabsTrigger({ className, ...rest }, ref) {
  return (
    <RadixTabs.Trigger
      ref={ref}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-sm px-3 text-body-sm font-medium text-text-muted",
        "transition-colors duration-fast ease-standard",
        "data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-xs",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
});

export const TabsContent = forwardRef<
  React.ElementRef<typeof RadixTabs.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(function TabsContent({ className, ...rest }, ref) {
  return <RadixTabs.Content ref={ref} className={cn("mt-4", className)} {...rest} />;
});
