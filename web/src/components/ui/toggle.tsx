"use client";

import * as RadixToggle from "@radix-ui/react-toggle";
import { forwardRef } from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/cn";

const toggle = tv({
  base: [
    "inline-flex items-center justify-center gap-2 rounded-md border text-body-sm font-medium",
    "transition-colors duration-fast ease-standard",
    "disabled:pointer-events-none disabled:opacity-50",
    "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary",
    "data-[state=off]:bg-surface data-[state=off]:text-text data-[state=off]:border-border-strong",
    "hover:data-[state=off]:bg-surface-2",
  ].join(" "),
  variants: {
    size: {
      sm: "h-8 px-3",
      md: "h-10 px-4",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type ToggleVariants = VariantProps<typeof toggle>;

export type ToggleProps = React.ComponentPropsWithoutRef<typeof RadixToggle.Root> & {
  size?: ToggleVariants["size"];
};

export const Toggle = forwardRef<
  React.ElementRef<typeof RadixToggle.Root>,
  ToggleProps
>(function Toggle({ className, size, ...rest }, ref) {
  return <RadixToggle.Root ref={ref} className={cn(toggle({ size }), className)} {...rest} />;
});
