import { redirect } from "next/navigation";

import { AgencyWizard } from "@/components/onboarding/agency-wizard";
import { ConsumerWizard } from "@/components/onboarding/consumer-wizard";
import { getOnboardingServer, getSessionServer } from "@/lib/session";

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

  const kind =
    state.kind ??
    (session.role === "consumer" ? "consumer" : "agency");

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
