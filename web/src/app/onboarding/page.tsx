import { redirect } from "next/navigation";

import { AgencyWizard } from "@/components/onboarding/agency-wizard";
import { ConsumerWizard } from "@/components/onboarding/consumer-wizard";
import {
  getEntitlement,
  getOnboardingServer,
  getSessionServer,
} from "@/lib/session";

export const metadata = {
  title: "Set up your account · Atlas Weather",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Post-login wizard entry. Dispatches to the consumer or agency flow based on
 * the session role (or the `onboarding.kind` that was persisted on a previous
 * visit). A completed record short-circuits to the map so the route stays
 * idempotent if users deep-link back.
 */
export default async function OnboardingPage() {
  const session = await getSessionServer();
  if (!session) redirect("/login");

  const state = await getOnboardingServer();
  if (!state) redirect("/login");

  if (state.completed) redirect("/map");

  // No persisted choice yet: an agency plan means the agency flow, anything
  // else the consumer one. The session's `role` is a *membership* role
  // (owner/admin/agent/member) and says nothing about which product the user
  // is here for — a consumer-premium subscriber is the "owner" of their own
  // single-seat org.
  const kind = state.kind ?? (getEntitlement(session).agency ? "agency" : "consumer");

  if (kind === "agency") {
    return (
      <AgencyWizard
        initial={state}
        plan={session.plan}
        organizationId={session.org?.id}
      />
    );
  }

  return <ConsumerWizard initial={state} plan={session.plan} />;
}
