"use client";

/**
 * °C / °F switch. Two radio-style buttons rather than a checkbox: the choice
 * is between two named things, and a toggle whose label is one of its own
 * states ("°F") never says which state it is currently in.
 *
 * Writing the choice is the provider's job; this only reports it. `onChange`
 * lets a caller do something extra with the same click — the map mirrors it
 * into the URL so a shared link carries the sender's units.
 */

import { useUnit } from "@/components/units/unit-provider";
import { cn } from "@/lib/cn";
import type { UnitSystem } from "@/lib/units";

const OPTIONS: readonly { value: UnitSystem; label: string; name: string }[] = [
  { value: "metric", label: "°C", name: "Celsius" },
  { value: "imperial", label: "°F", name: "Fahrenheit" },
];

export type UnitToggleProps = {
  /** Called after the preference is stored, with the new value. */
  onChange?: (next: UnitSystem) => void;
  /** Heading above the control. Omit inside a row that already has one. */
  label?: string;
  hint?: string;
  className?: string;
};

export function UnitToggle({
  onChange,
  label = "Temperature unit",
  hint,
  className,
}: UnitToggleProps) {
  const { unit, setUnit } = useUnit();

  return (
    <div className={className}>
      {label ? (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-[12.5px] font-medium text-text">{label}</span>
          {hint ? (
            <span className="font-mono text-[11px] text-text-muted">{hint}</span>
          ) : null}
        </div>
      ) : null}
      <div
        role="radiogroup"
        aria-label="Temperature unit"
        data-testid="unit-toggle"
        className="flex overflow-hidden rounded-md border border-border"
      >
        {OPTIONS.map((option) => {
          const active = unit === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.name}
              data-testid={`unit-${option.value}`}
              onClick={() => {
                if (!active) {
                  setUnit(option.value);
                  onChange?.(option.value);
                }
              }}
              className={cn(
                "flex-1 px-3 py-2 font-mono text-[13px] outline-none transition",
                "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-focus-ring)]",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
