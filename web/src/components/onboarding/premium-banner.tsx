export type PremiumBannerProps = {
  /** "Premium", "Agency Pro", etc. Shown in the eyebrow. */
  plan: string;
};

/**
 * Post-checkout confirmation banner shown at the top of onboarding steps once
 * a Paddle sandbox subscription has activated. Pure presentational — the
 * wizard shell controls when to render it based on `session.plan`.
 */
export function PremiumBanner({ plan }: PremiumBannerProps) {
  return (
    <aside
      aria-live="polite"
      className="mb-6 flex items-center gap-4 rounded-lg border border-accent bg-gradient-to-b from-[#FBF3DC] to-[#F7EBC8] px-5 py-4"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12l4 4L19 7" strokeLinecap="round" />
        </svg>
      </span>
      <div className="flex-1">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-accent">
          Welcome to {plan}
        </p>
        <p className="mt-0.5 font-display text-[18px] font-medium leading-tight tracking-[-0.005em] text-text">
          Your subscription is active.
        </p>
        <p className="mt-0.5 text-[12px] text-text-muted">
          Receipt sent to your email. You can manage billing any time from
          Settings → Billing.
        </p>
      </div>
    </aside>
  );
}
