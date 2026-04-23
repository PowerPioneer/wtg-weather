import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type OptionTileProps = {
  label: string;
  sub?: string;
  selected?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

/**
 * Large click-target tile used in the "pick your units" step (Celsius vs
 * Fahrenheit, km vs mi, etc.). Serif label, mono sublabel, thick border on
 * the selected option.
 */
export function OptionTile({
  label,
  sub,
  selected,
  className,
  ...rest
}: OptionTileProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "flex-1 rounded-md px-4 py-3.5 text-left transition-colors duration-fast ease-standard",
        "focus-visible:outline-focus-ring",
        selected
          ? "border-[1.5px] border-text bg-surface shadow-[inset_0_0_0_1px_var(--color-text)]"
          : "border-[1.5px] border-border bg-transparent hover:bg-surface",
        className,
      )}
      {...rest}
    >
      <span className="block font-display text-[20px] font-medium leading-tight tracking-[-0.005em] text-text">
        {label}
      </span>
      {sub ? (
        <span className="mt-0.5 block font-mono text-[11px] text-text-subtle">
          {sub}
        </span>
      ) : null}
    </button>
  );
}
