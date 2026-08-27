/**
 * Pricing and upgrade-path copy. This is the single source of truth that
 * `/pricing`, the upgrade modal, and any "locked" overlay reads from.
 *
 * Mirrors `web/design/pricing/tierData.js`; diverges from it in two places,
 * both deliberate:
 *
 *   1. "Export match reports to PDF" is listed on Premium — this is a
 *      consumer-ask that we're committing to in Phase 5.3; the generator
 *      itself ships in Phase 5.7 but the tier gains the feature now so the
 *      price points don't have to change later.
 *   2. The agency tiers carry `hidden: true` until agency onboarding ships
 *      in Phase 6. `consumerTiers()` below is what the public pricing page
 *      reads; the full list is still exported for the /agency page.
 */

import type { PaddlePlan } from "@/lib/paddle";
import type { Tier } from "@/lib/types";

export const PRICING_HERO = {
  eyebrow: "Pricing",
  headline: "Plan trips around the weather you actually like.",
  sub: "Ten years of ERA5 climate data and six-government travel advisories in one map. Free to explore. €2.99/mo to go deeper.",
} as const;

export const PREMIUM_COPY = {
  headline: "See past the average.",
  bullets: [
    "Zoom past admin-1 into district-level climate — compare Cusco vs. Lima, not just Peru.",
    "See how each of the six governments actually rates your destination, not the most-cautious consensus.",
    "10 / 50 / 90 percentile bands on every chart — April is 18°C, but how often is it 11 or 26?",
    "Four extra variables: snow depth, sea-surface temperature, heat index, humidity.",
    "Save unlimited trips, get an email the moment a destination starts matching your preferences.",
  ],
} as const;

/**
 * The upgrade prompt shown where a free user meets a premium feature.
 *
 * Keyed by feature so every surface asks the same way. Lives here rather than
 * inline at each call site because the pricing page, the tier table and these
 * prompts have to agree about what Premium actually includes — the alerts line
 * below is the same promise `TIERS.premium.features` makes.
 */
export const UPGRADE_PROMPTS = {
  alerts: {
    title: "Alerts are a Premium feature.",
    body: "Get an email the moment a destination starts matching your preferences — no need to keep checking back.",
    cta: "See Premium · €2.99/mo",
  },
} as const;

export type UpgradePromptId = keyof typeof UPGRADE_PROMPTS;

/**
 * The one label every upgrade CTA wears, and the strings the checkout handoff
 * shows while it is working or when it fails.
 *
 * Sourced here rather than inline at each button because the price appears in
 * it: `€2.99/mo` is in `TIERS.premium.cta.label`, in the map popover, in the
 * display-mode picker's footnote, and on the onboarding card. A price change
 * that reaches four of those five is worse than one that reaches none.
 */
export const CHECKOUT_COPY = {
  /** Primary label. Matches `TIERS.premium.cta.label` by construction below. */
  cta: "Try Premium · €2.99/mo",
  pending: "Opening checkout…",
  /** Shown when `requestCheckoutUrl` fails for any reason but a missing session. */
  error: "Couldn't open checkout. Try again in a moment.",
  /** Shown while we bounce an anonymous visitor through sign-in. */
  signIn: "Sign in to continue…",
  sandboxNote: "Sandbox Paddle · no real charges in dev",
} as const;

/**
 * What the map's inline popover says for each locked feature.
 *
 * The four variable entries restate `TIERS.premium.features`; `admin2` is the
 * zoom gate, which has no feature bullet of its own because it is the headline
 * on the tier card.
 */
export const PREMIUM_FEATURE_COPY = {
  admin2: {
    title: "District-level detail",
    body: "Zoom past the country level into admin-2 districts — precise climate and safety inside every country.",
  },
  snow: { title: "Snow depth", body: "Mean snow depth for the month, from the same 10-year ERA5 window." },
  sst: { title: "Sea surface temperature", body: "How warm the water actually is — the number that decides whether the coast is worth it." },
  heat: { title: "Heat index", body: "Temperature and humidity combined, which is what the day actually feels like." },
  humidity: { title: "Humidity", body: "Relative humidity for the month — the difference between 30°C pleasant and 30°C unbearable." },
} as const;

export type PremiumFeatureId = keyof typeof PREMIUM_FEATURE_COPY;

/** Footnote under the display-mode picker when the session is not entitled. */
export const DISPLAY_MODE_UPSELL =
  "Unlock all 10 variables, saved trips, percentile bands, and no ads for €2.99/mo.";

/**
 * Copy for the two Paddle return pages. The success page polls `/api/me`
 * because the plan does not change when the browser comes back — it changes
 * when Paddle's webhook reaches the API, and then only after the 60-second
 * entitlements cache lets go. Saying so is the whole job of this text: the
 * alternative is a spinner that looks broken for a minute after a payment.
 */
export const CHECKOUT_RETURN_COPY = {
  success: {
    eyebrow: "Payment received",
    waitingTitle: "Activating your subscription…",
    waitingBody:
      "Paddle has taken the payment and is telling us about it now. This usually takes a few seconds — you don't need to refresh, and nothing is lost if you navigate away.",
    doneTitle: "Premium is active.",
    doneBody:
      "District-level zoom, the four extra variables, percentile bands and alerts are unlocked on this account.",
    slowTitle: "Still waiting on the payment provider.",
    slowBody:
      "The payment went through — Paddle just hasn't reached us yet. It will land on its own; your receipt is already in your inbox. If Premium still isn't showing in a few minutes, get in touch and we'll sort it out.",
    ctaMap: "Open the map",
    ctaAccount: "Go to your account",
  },
  cancel: {
    eyebrow: "Checkout cancelled",
    title: "No payment was taken.",
    body: "You closed the checkout before paying, so nothing was charged and your account is unchanged. The free map is exactly where you left it.",
    ctaRetry: "Back to pricing",
    ctaMap: "Keep using the free map",
  },
} as const;

type TierEntry = Tier & { hidden?: boolean };

const TIERS: readonly TierEntry[] = [
  {
    id: "free",
    name: "Free",
    eyebrow: "For the curious",
    price: { monthly: 0, yearly: 0, suffix: "" },
    cta: { label: "Start free", kind: "ghost" },
    subline: "Everything you need to explore.",
    features: [
      "Country and admin-1 (state / region) zoom",
      "Climate variables: Temperature, Rainfall, Sunshine, Wind speed",
      "Safety advisories from US, UK, Canada, Australia, Germany (combined view, most-cautious-wins)",
      "Display modes: My Preferences, Temperature, Rainfall, Sunshine, Wind, Safety",
      "10-year monthly climatology averages",
      "Ad-supported",
    ],
  },
  {
    id: "premium",
    name: "Consumer Premium",
    shortName: "Premium",
    eyebrow: "Most travellers",
    featured: true,
    price: { monthly: 2.99, yearly: 24, suffix: "/mo" },
    yearlyNote: "€24/yr — save 33%",
    cta: { label: "Try Premium · €2.99/mo", kind: "primary" },
    subline: "Everything in Free, plus:",
    featuredBullets: [
      "Admin-2 (district) deep zoom",
      "Per-government advisory breakdown",
      "Export match reports to PDF",
    ],
    features: [
      "Admin-2 (district / county) deep zoom",
      "Additional variables: Snow depth, Sea surface temperature, Heat index, Humidity",
      "10 / 50 / 90 percentile bands on charts (see how variable the weather actually is, not just the average)",
      "Export match reports to PDF (full country or per-month, with sources)",
      "Save unlimited trips",
      "Save favourite destinations",
      "Email alerts when a destination starts matching your preferences",
      "No ads",
      "Per-government advisory breakdown view (see how each country rates a destination, not just the combined view)",
    ],
  },
  {
    id: "starter",
    name: "Agency Starter",
    shortName: "Starter",
    eyebrow: "Small agencies",
    agency: true,
    hidden: true,
    price: { monthly: 39, yearly: Math.round(39 * 12 * 0.83), suffix: "/mo" },
    seats: "3 seats included",
    cta: { label: "Start 14-day trial", kind: "outline" },
    subline: "Everything in Premium for 3 seats, plus:",
    features: [
      "Client management (create client profiles, store their preferences, assign trips)",
      "Shared organisation workspace",
      "Audit log of all agent actions",
      "Branded shareable trip pages (your agency name on /trips/[id])",
    ],
  },
  {
    id: "pro",
    name: "Agency Pro",
    shortName: "Pro",
    eyebrow: "Growing agencies",
    agency: true,
    hidden: true,
    price: { monthly: 99, yearly: Math.round(99 * 12 * 0.83), suffix: "/mo" },
    seats: "10 seats included",
    cta: { label: "Start 14-day trial", kind: "outline" },
    subline: "Everything in Starter, plus:",
    features: ["10 seats", "Priority support", "Advanced filters and export options"],
  },
  {
    id: "enterprise",
    name: "Agency Enterprise",
    shortName: "Enterprise",
    eyebrow: "Large operators",
    agency: true,
    hidden: true,
    price: { monthly: null, yearly: null, suffix: "" },
    priceDisplay: "Custom",
    cta: { label: "Contact sales", kind: "outline" },
    subline: "Everything in Pro, plus:",
    features: [
      "Unlimited seats",
      "API access for integration with your booking systems",
      "Custom data refresh cadence",
      "White-label (subdomain + full branding) — coming 2026",
      "SLA and dedicated support",
    ],
  },
] as const;

/** Tiers shown on the public pricing page — agency tiers are hidden for now. */
export function consumerTiers(): readonly Tier[] {
  return TIERS.filter((t) => !t.hidden);
}

/** All tiers, used by the `/agency` page and the internal tier comparison. */
export function allTiers(): readonly Tier[] {
  return TIERS;
}

export function findTier(id: Tier["id"]): Tier | undefined {
  return TIERS.find((t) => t.id === id);
}

/**
 * Which Paddle plan a pricing tier buys.
 *
 * The two vocabularies are genuinely different and both are load-bearing:
 * tier ids are the design system's (`premium`, `starter`), plan values are the
 * API's (`consumer_premium`, `agency_starter`) and reach the webhook through
 * `custom_data`. This is the only place they meet. `free` and `enterprise` buy
 * nothing — one is free and the other is a sales conversation — so they return
 * `null` and their CTA stays an ordinary link.
 */
export function planForTier(id: Tier["id"]): PaddlePlan | null {
  switch (id) {
    case "premium":
      return "consumer_premium";
    case "starter":
      return "agency_starter";
    case "pro":
      return "agency_pro";
    default:
      return null;
  }
}

export const TRUST_SIGNALS: readonly { title: string; sub: string }[] = [
  { title: "10-year ERA5 climatology", sub: "ECMWF Reanalysis v5 — the reference climate dataset. Updated monthly." },
  { title: "5 government advisories", sub: "US, UK, Canada, Australia, Germany — refreshed daily, source & timestamp on every record." },
  { title: "EU VAT handled by Paddle", sub: "Paddle is our Merchant of Record. Invoices in your country, local currency, legally compliant." },
  { title: "No card details stored", sub: "We never see your card. PCI-DSS handled end-to-end by Paddle." },
  { title: "Cancel anytime", sub: "One-click cancellation from your Paddle customer portal. Refunds within 14 days, no questions." },
  { title: "Data from six governments", sub: "Every advisory record links to its source and carries the publication timestamp." },
];

export const PRICING_FAQ: readonly { q: string; a: string }[] = [
  {
    q: "What does the €2.99/mo actually unlock?",
    a: "Deeper zoom (admin-2 districts, not just countries), four extra variables (snow, sea-surface temperature, heat index, humidity), percentile bands on every chart so you can see variability not just averages, the per-government breakdown of travel advisories, PDF export of your match reports, saved trips, email alerts, and no ads.",
  },
  {
    q: "What is ERA5 and why should I trust it?",
    a: "ERA5 is the European Centre for Medium-Range Weather Forecasts’ reanalysis dataset — a reconstruction of global climate from 1950 to today at ~25km resolution, used by the IPCC and most working climate scientists. We compute 10-year monthly averages from it, so what you see is calibrated against a decade of real observations, not a forecast.",
  },
  {
    q: "Whose travel advisories are these?",
    a: "Five governments: United States, United Kingdom, Canada, Australia, Germany. By default we show the most-cautious view (the highest advisory across the five). Premium unlocks the per-government breakdown so you can see where they agree and where they diverge — useful when one government flags a region others don’t.",
  },
  {
    q: "Can I cancel? How do refunds work?",
    a: "Yes, cancel anytime from the Paddle customer portal (one click, linked from your account). Refunds are granted within 14 days of purchase, no questions. After cancellation you keep Premium access until the end of the billing period.",
  },
];
