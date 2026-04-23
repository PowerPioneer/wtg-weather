"use client";

import * as RadixProgress from "@radix-ui/react-progress";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

export type ProgressProps = React.ComponentPropsWithoutRef<typeof RadixProgress.Root> & {
  value?: number | null;
};

export const Progress = forwardRef<
  React.ElementRef<typeof RadixProgress.Root>,
  ProgressProps
>(function Progress({ className, value, ...rest }, ref) {
  const pct = value == null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <RadixProgress.Root
      ref={ref}
      value={value ?? undefined}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2",
        className,
      )}
      {...rest}
    >
      <RadixProgress.Indicator
        className="h-full bg-primary transition-[width] duration-base ease-standard"
        style={{ width: `${pct}%` }}
      />
    </RadixProgress.Root>
  );
});
