import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/cn";

const card = tv({
  base: "rounded-lg",
  variants: {
    tone: {
      paper: "bg-surface",
      inset: "bg-surface-2",
      sunken: "bg-surface-sunken",
    },
    padding: {
      none: "p-0",
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    },
    bordered: {
      true: "border border-border",
      false: "",
    },
    elevated: {
      true: "shadow-sm",
      false: "",
    },
  },
  defaultVariants: {
    tone: "paper",
    padding: "md",
    bordered: true,
    elevated: false,
  },
});

type CardVariants = VariantProps<typeof card>;

export type CardProps = {
  tone?: CardVariants["tone"];
  padding?: CardVariants["padding"];
  bordered?: boolean;
  elevated?: boolean;
} & HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { tone, padding, bordered, elevated, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(card({ tone, padding, bordered, elevated }), className)}
      {...rest}
    />
  );
});

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...rest }, ref) {
    return <div ref={ref} className={cn("mb-4 flex flex-col gap-1", className)} {...rest} />;
  },
);

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...rest }, ref) {
    return (
      <h3
        ref={ref}
        className={cn("text-h3 font-display font-medium text-text", className)}
        {...rest}
      />
    );
  },
);

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...rest }, ref) {
  return (
    <p ref={ref} className={cn("text-body-sm text-text-muted", className)} {...rest} />
  );
});

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn("mt-6 flex items-center justify-end gap-3", className)}
        {...rest}
      />
    );
  },
);
