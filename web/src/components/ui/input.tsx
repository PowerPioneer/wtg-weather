import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, type = "text", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-10 w-full rounded-md border bg-surface px-3 text-body-sm text-text",
        "placeholder:text-text-subtle",
        "transition-colors duration-fast ease-standard",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid ? "border-destructive" : "border-border-strong",
        className,
      )}
      {...rest}
    />
  );
});

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, ...rest },
  ref,
) {
  return (
    <label
      ref={ref}
      className={cn("text-label text-text-muted", className)}
      {...rest}
    />
  );
});
