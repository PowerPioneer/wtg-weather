import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Site-wide content container. `max-w-[1280px]` matches the Atlas design
 * `size-container-max` token; the gutter (`px-6 md:px-12`) matches
 * `size-gutter-mobile` (20–24px) and `size-gutter-desktop` (48px).
 */
export function Container({
  className,
  narrow,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { narrow?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-6 md:px-12",
        narrow ? "max-w-[720px]" : "max-w-[1280px]",
        className,
      )}
      {...rest}
    />
  );
}
