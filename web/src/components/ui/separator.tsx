"use client";

import * as RadixSeparator from "@radix-ui/react-separator";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

export type SeparatorProps = React.ComponentPropsWithoutRef<typeof RadixSeparator.Root>;

export const Separator = forwardRef<
  React.ElementRef<typeof RadixSeparator.Root>,
  SeparatorProps
>(function Separator({ className, orientation = "horizontal", decorative = true, ...rest }, ref) {
  return (
    <RadixSeparator.Root
      ref={ref}
      orientation={orientation}
      decorative={decorative}
      className={cn(
        "bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...rest}
    />
  );
});
