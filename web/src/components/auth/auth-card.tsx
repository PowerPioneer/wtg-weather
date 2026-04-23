import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type AuthCardProps = {
  /** Optional header slot — renders above the title (e.g. the envelope icon on the sent card). */
  header?: ReactNode;
  title: string;
  /** Subtitle accepts nodes so callers can bold the email address, etc. */
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Atlas-style auth card. Used by `/login` and `/login/sent`. Width, padding,
 * and shadow are fixed so the two screens line up pixel-for-pixel — if a
 * caller needs a different width it should own its own wrapper rather than
 * parameterising this one.
 */
export function AuthCard({ header, title, subtitle, children, className }: AuthCardProps) {
  return (
    <section
      className={cn(
        "w-full max-w-[440px] rounded-lg border border-border bg-surface p-9",
        "shadow-[0_1px_2px_rgba(15,27,45,0.04),0_8px_24px_rgba(15,27,45,0.05)]",
        className,
      )}
    >
      {header}
      <h1 className="font-display text-[26px] font-medium leading-[1.15] tracking-[-0.012em] text-text">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1.5 text-body-sm leading-[1.55] text-text-muted">{subtitle}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
