import { cn } from "@/lib/cn";

export type WizardStepperProps = {
  /** Zero-based index of the step currently in progress. */
  current: number;
  total: number;
  className?: string;
};

/**
 * Progress bar for the onboarding wizard. Atlas spec: flat 3px bars, accent
 * colour for the in-progress step, ink for completed, border for pending.
 * Separate from the "Step N of M" eyebrow — callers render that alongside.
 */
export function WizardStepper({ current, total, className }: WizardStepperProps) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={Math.min(current + 1, total)}
      aria-label={`Step ${Math.min(current + 1, total)} of ${total}`}
      className={cn("flex items-center gap-1", className)}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "h-[3px] flex-1 rounded-full transition-colors duration-fast ease-standard",
            i < current && "bg-text",
            i === current && "bg-accent",
            i > current && "bg-border",
          )}
        />
      ))}
    </div>
  );
}
