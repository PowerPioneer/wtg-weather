import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/cn";

const chip = tv({
  base: [
    "inline-flex items-center gap-1.5 rounded-full font-mono uppercase",
    "border border-transparent",
    "tracking-[0.12em]",
  ].join(" "),
  variants: {
    variant: {
      neutral: "bg-surface-2 text-text-muted",
      premium: "bg-accent-subtle text-accent border-accent/30",
      good: "bg-score-good-subtle text-score-good",
      warm: "bg-score-acceptable-subtle text-score-acceptable",
      avoid: "bg-score-avoid-subtle text-score-avoid",
      caution: "bg-advisory-caution/15 text-advisory-caution",
    },
    size: {
      xs: "h-5 px-2 text-[10.5px]",
      sm: "h-6 px-2.5 text-[11px]",
    },
  },
  defaultVariants: {
    variant: "neutral",
    size: "sm",
  },
});

type ChipVariants = VariantProps<typeof chip>;

export type ChipProps = {
  variant?: ChipVariants["variant"];
  size?: ChipVariants["size"];
  leadingDot?: boolean;
} & HTMLAttributes<HTMLSpanElement>;

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  { variant, size, leadingDot, className, children, ...rest },
  ref,
) {
  return (
    <span ref={ref} className={cn(chip({ variant, size }), className)} {...rest}>
      {leadingDot ? (
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
        />
      ) : null}
      {children}
    </span>
  );
});
