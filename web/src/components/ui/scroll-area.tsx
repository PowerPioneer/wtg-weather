"use client";

import * as RadixScrollArea from "@radix-ui/react-scroll-area";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

export const ScrollArea = forwardRef<
  React.ElementRef<typeof RadixScrollArea.Root>,
  React.ComponentPropsWithoutRef<typeof RadixScrollArea.Root>
>(function ScrollArea({ className, children, ...rest }, ref) {
  return (
    <RadixScrollArea.Root
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...rest}
    >
      <RadixScrollArea.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </RadixScrollArea.Viewport>
      <ScrollBar />
      <RadixScrollArea.Corner />
    </RadixScrollArea.Root>
  );
});

export const ScrollBar = forwardRef<
  React.ElementRef<typeof RadixScrollArea.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof RadixScrollArea.ScrollAreaScrollbar>
>(function ScrollBar({ className, orientation = "vertical", ...rest }, ref) {
  return (
    <RadixScrollArea.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      className={cn(
        "flex touch-none select-none p-0.5 transition-colors duration-fast ease-standard",
        orientation === "vertical" ? "h-full w-2.5" : "h-2.5 flex-col",
        className,
      )}
      {...rest}
    >
      <RadixScrollArea.ScrollAreaThumb className="relative flex-1 rounded-full bg-border-strong" />
    </RadixScrollArea.ScrollAreaScrollbar>
  );
});
