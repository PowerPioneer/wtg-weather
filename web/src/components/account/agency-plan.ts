import type { AccountPlan } from "@/lib/types";

/**
 * Which plan an agency moves to next.
 *
 * Only the *shape* of the ladder lives here — which plan follows which. Prices
 * come from the pricing tiers and the seat cap comes from the org record,
 * because the Paddle webhook sets that and a second table in the UI could
 * disagree with the one actually being enforced.
 *
 * Enterprise has no self-serve step above it: that is a conversation, and a
 * button opening a checkout for a price nobody has agreed would be worse than
 * no button.
 *
 * Its own module (not `agency-sections.tsx`) because the seat-cap panel is a
 * client island that needs it, and importing it from the server section file
 * would make the two circular.
 */
const NEXT_PLAN: Partial<Record<AccountPlan, "agency_pro">> = {
  free: "agency_pro",
  consumer_premium: "agency_pro",
  agency_starter: "agency_pro",
};

export function nextAgencyPlan(plan: AccountPlan): "agency_pro" | null {
  return NEXT_PLAN[plan] ?? null;
}
