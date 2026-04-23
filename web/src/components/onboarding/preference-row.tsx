import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type PreferenceRowProps = {
  icon: ReactNode;
  label: string;
  sub: string;
  value: string;
  /** Dims the row and shows a "PREMIUM" badge alongside the label. */
  premium?: boolean;
};

/**
 * One row in the default-preferences step. Icon + label + sub on the left,
 * mono value on the right. Visual target: the `PrefRow` component in the
 * Atlas design reference.
 */
export function PreferenceRow({
  icon,
  label,
  sub,
  value,
  premium,
}: PreferenceRowProps) {
  return (
    <div
      className={cn(
        "grid items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0",
        "grid-cols-[28px_1fr_auto]",
        premium && "opacity-60",
      )}
    >
      <span
        aria-hidden
        className="flex h-[26px] w-[26px] items-center justify-center rounded-sm border border-border bg-surface-2 text-text-muted"
      >
        {icon}
      </span>
      <div>
        <p className="flex items-center gap-2 text-[13px] font-medium text-text">
          {label}
          {premium ? (
            <span className="rounded-sm border border-accent px-1.5 py-[1px] font-mono text-[9.5px] uppercase tracking-[0.1em] text-accent">
              Premium
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-[11px] text-text-subtle">{sub}</p>
      </div>
      <p className="font-mono text-[12px] text-text">{value}</p>
    </div>
  );
}
